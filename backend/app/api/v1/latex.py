import asyncio
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.app.api.deps import get_current_user
from backend.app.core.config import settings
from backend.app.models.user import User

router = APIRouter(prefix="/latex", tags=["LaTeX Compiler"])
_compile_slots = asyncio.Semaphore(2)


class LatexCompileRequest(BaseModel):
    source: str = Field(min_length=1, max_length=200_000)
    filename: str = Field(default="document", min_length=1, max_length=100)
    theme: str = Field(default="light", pattern="^(light|dark)$")


def _compile_tex(source: str, theme: str = "light") -> tuple[bytes, str]:
    configured = settings.TECTONIC_PATH
    executable = shutil.which(configured) if not Path(configured).is_absolute() else configured
    if not executable:
        project_tectonic = Path(__file__).resolve().parents[4] / ".tools" / "tectonic" / "tectonic.exe"
        if project_tectonic.is_file():
            executable = str(project_tectonic)
    if not executable or not Path(executable).is_file():
        raise HTTPException(
            status_code=503,
            detail="The LaTeX compiler is not installed or configured. Install Tectonic and set TECTONIC_PATH, then restart the backend.",
        )

    with tempfile.TemporaryDirectory(prefix="nexus-tex-") as temp_dir:
        workdir = Path(temp_dir)
        input_path = workdir / "document.tex"
        output_path = workdir / "document.pdf"
        if theme == "dark" and re.search(r"\\begin\s*\{document\}", source):
            if not re.search(r"\\usepackage(?:\[[^]]*\])?\{[^}]*\bxcolor\b", source):
                source = re.sub(r"(\\documentclass(?:\[[^]]*\])?\{[^}]+\})", r"\1\n\\usepackage{xcolor}", source, count=1)
            source = re.sub(
                r"(\\begin\s*\{document\})",
                r"\1\n\\pagecolor[HTML]{151922}\\color[HTML]{E8EDF5}",
                source,
                count=1,
            )
        input_path.write_text(source, encoding="utf-8")
        environment = os.environ.copy()
        environment["TECTONIC_UNTRUSTED_MODE"] = "1"
        try:
            result = subprocess.run(
                [executable, "-X", "compile", "--untrusted", "--outdir", str(workdir), str(input_path)],
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=settings.LATEX_COMPILE_TIMEOUT_SECONDS,
                check=False,
                env=environment,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=408, detail="LaTeX compilation timed out. Reduce document size or complexity and try again.") from exc
        except OSError as exc:
            raise HTTPException(status_code=503, detail="The configured LaTeX compiler could not be started.") from exc

        if result.returncode != 0 or not output_path.is_file():
            diagnostics = (result.stderr or result.stdout or "Compilation failed without diagnostics.").strip()
            diagnostics = re.sub(r"[\r\n]+", "\n", diagnostics)[-5000:]
            raise HTTPException(status_code=422, detail=f"LaTeX compilation failed:\n{diagnostics}")

        if output_path.stat().st_size > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Compiled PDF exceeds the 25 MB output limit.")
        pdf_data = output_path.read_bytes()
        if not pdf_data.startswith(b"%PDF-"):
            raise HTTPException(status_code=500, detail="The compiler did not produce a valid PDF file.")
        return pdf_data, output_path.name


@router.post("/compile")
async def compile_latex(
    request: LatexCompileRequest,
    current_user: User = Depends(get_current_user),
):
    del current_user  # Authentication protects compilation from anonymous resource abuse.
    try:
        await asyncio.wait_for(_compile_slots.acquire(), timeout=settings.LATEX_COMPILE_TIMEOUT_SECONDS + 5)
    except TimeoutError as exc:
        raise HTTPException(status_code=429, detail="LaTeX compiler is busy. Please retry shortly.") from exc
    try:
        pdf_data, _ = await run_in_threadpool(_compile_tex, request.source, request.theme)
    finally:
        _compile_slots.release()

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", request.filename).strip(".-_")[:80] or "document"
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_name}.pdf"', "Cache-Control": "no-store"},
    )
