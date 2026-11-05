UPDATE daily_questions
SET question_latex = 'State the time-dependent Schrodinger wave equation: $i\hbar \frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \hat{H}\Psi(\mathbf{r}, t)$.',
    explanation_latex = 'It describes how a quantum state changes over time under a Hamiltonian: $i\hbar \partial_t \Psi = \hat{H}\Psi$.'
WHERE id = 'qotd-seed-20261105';
