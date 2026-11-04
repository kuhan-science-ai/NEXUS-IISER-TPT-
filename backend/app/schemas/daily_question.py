from pydantic import BaseModel, Field, field_validator


class DailyQuestionAnswerCreate(BaseModel):
    answer_latex: str = Field(..., min_length=1, max_length=2000)
    selected_option: int = Field(..., ge=0, le=3)
    attachment_file_id: str | None = Field(default=None, max_length=36)


class DailyQuestionAnswerCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: str | None = None


class DailyQuestionProposalCreate(BaseModel):
    category: str = Field(..., min_length=3, max_length=50)
    question_latex: str = Field(..., min_length=10, max_length=5000)
    options: list[str] = Field(..., min_length=4, max_length=4)
    correct_option: int = Field(..., ge=0, le=3)
    explanation_latex: str = Field(..., min_length=10, max_length=5000)
    template_notes: str = Field(default="", max_length=1500)
    animation_notes: str = Field(default="", max_length=1500)

    @field_validator("options")
    @classmethod
    def validate_options(cls, options: list[str]) -> list[str]:
        cleaned = [option.strip() for option in options]
        if any(not option for option in cleaned):
            raise ValueError("All four answer options are required")
        if any(len(option) > 1000 for option in cleaned):
            raise ValueError("Each answer option must be 1,000 characters or fewer")
        return cleaned

    @field_validator("question_latex", "explanation_latex")
    @classmethod
    def validate_latex_content(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 10:
            raise ValueError("Add a complete question and worked explanation")
        return cleaned

    @field_validator("category")
    @classmethod
    def validate_category(cls, category: str) -> str:
        cleaned = category.strip()
        if cleaned not in {"Physics", "Chemistry", "Mathematics"}:
            raise ValueError("Choose Physics, Chemistry, or Mathematics")
        return cleaned
