(() => {
    const normalPuzzle = [
        [0, 0, 3, 0, 2, 0, 6, 0, 0],
        [9, 0, 0, 3, 0, 5, 0, 0, 1],
        [0, 0, 1, 8, 0, 6, 4, 0, 0],
        [0, 0, 8, 1, 0, 2, 9, 0, 0],
        [7, 0, 0, 0, 0, 0, 0, 0, 8],
        [0, 0, 6, 7, 0, 8, 2, 0, 0],
        [0, 0, 2, 6, 0, 9, 5, 0, 0],
        [8, 0, 0, 2, 0, 3, 0, 0, 9],
        [0, 0, 5, 0, 1, 0, 3, 0, 0]
    ];

    const normalSolution = [
        [4, 8, 3, 9, 2, 1, 6, 5, 7],
        [9, 6, 7, 3, 4, 5, 8, 2, 1],
        [2, 5, 1, 8, 7, 6, 4, 9, 3],
        [5, 4, 8, 1, 3, 2, 9, 7, 6],
        [7, 2, 9, 5, 6, 4, 1, 3, 8],
        [1, 3, 6, 7, 9, 8, 2, 4, 5],
        [3, 7, 2, 6, 8, 9, 5, 1, 4],
        [8, 1, 4, 2, 5, 3, 7, 6, 9],
        [6, 9, 5, 4, 1, 7, 3, 8, 2]
    ];

    const kidsPuzzle = [
        [1, 0, 0, 4],
        [0, 4, 1, 0],
        [0, 1, 4, 0],
        [4, 0, 0, 1]
    ];

    const kidsSolution = [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1]
    ];

    const modes = {
        normal: {
            size: 9,
            boxSize: 3,
            symbols: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            puzzle: normalPuzzle,
            solution: normalSolution,
            difficulties: [
                { label: 'Łatwy', extraHints: 10 },
                { label: 'Normalny', extraHints: 4 },
                { label: 'Trudniejszy', extraHints: 0 }
            ]
        },
        kids: {
            size: 4,
            boxSize: 2,
            symbols: ['🐶', '🐱', '🐼', '🦊'],
            puzzle: kidsPuzzle,
            solution: kidsSolution,
            difficulties: [
                { label: 'Maluch', extraHints: 4 },
                { label: 'Prosty', extraHints: 2 },
                { label: 'Wyzwanie', extraHints: 0 }
            ]
        }
    };

    const board = document.getElementById('sudoku-board');
    const choices = document.getElementById('sudoku-choices');
    const modeSelect = document.getElementById('sudoku-mode');
    const difficultySelect = document.getElementById('sudoku-difficulty');
    const newGameButton = document.getElementById('new-game');
    const checkButton = document.getElementById('check-game');
    const filledCount = document.getElementById('filled-count');
    const mistakesCount = document.getElementById('mistakes-count');
    const statusText = document.getElementById('sudoku-status');

    let currentMode = modes.normal;
    let values = [];
    let fixed = [];
    let selected = null;
    let mistakes = 0;

    function cloneGrid(grid) {
        return grid.map(row => [...row]);
    }

    function getBoxStart(index) {
        return Math.floor(index / currentMode.boxSize) * currentMode.boxSize;
    }

    function createPuzzleWithHints() {
        const difficulty = currentMode.difficulties[Number(difficultySelect.value)] || currentMode.difficulties[0];
        const puzzle = cloneGrid(currentMode.puzzle);
        const emptyCells = [];

        puzzle.forEach((row, rowIndex) => {
            row.forEach((value, columnIndex) => {
                if (value === 0) {
                    emptyCells.push([rowIndex, columnIndex]);
                }
            });
        });

        shuffle(emptyCells).slice(0, difficulty.extraHints).forEach(([row, column]) => {
            puzzle[row][column] = currentMode.solution[row][column];
        });

        return puzzle;
    }

    function shuffle(items) {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
        }
        return result;
    }

    function updateDifficulties() {
        currentMode = modes[modeSelect.value];
        difficultySelect.innerHTML = '';
        currentMode.difficulties.forEach((difficulty, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = difficulty.label;
            difficultySelect.appendChild(option);
        });
        difficultySelect.value = modeSelect.value === 'kids' ? '0' : '1';
    }

    function startGame() {
        currentMode = modes[modeSelect.value];
        const puzzle = createPuzzleWithHints();
        values = cloneGrid(puzzle);
        fixed = puzzle.map(row => row.map(value => value !== 0));
        selected = null;
        mistakes = 0;
        statusText.textContent = 'Gotowe';
        renderBoard();
        renderChoices();
        updateStats();
    }

    function renderBoard() {
        board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${currentMode.size}, 1fr)`;
        board.style.gridTemplateRows = `repeat(${currentMode.size}, 1fr)`;

        values.forEach((row, rowIndex) => {
            row.forEach((value, columnIndex) => {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = `sudoku-cell ${modeSelect.value}`;
                cell.dataset.row = String(rowIndex);
                cell.dataset.column = String(columnIndex);
                cell.textContent = value ? currentMode.symbols[value - 1] : '';
                cell.setAttribute('aria-label', `Wiersz ${rowIndex + 1}, kolumna ${columnIndex + 1}`);

                if (fixed[rowIndex][columnIndex]) {
                    cell.classList.add('fixed');
                }

                if ((columnIndex + 1) % currentMode.boxSize === 0 && columnIndex < currentMode.size - 1) {
                    cell.classList.add('border-right-strong');
                }

                if ((rowIndex + 1) % currentMode.boxSize === 0 && rowIndex < currentMode.size - 1) {
                    cell.classList.add('border-bottom-strong');
                }

                cell.addEventListener('click', () => selectCell(rowIndex, columnIndex));
                board.appendChild(cell);
            });
        });

        refreshHighlights();
    }

    function renderChoices() {
        choices.innerHTML = '';
        currentMode.symbols.forEach((symbol, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn btn-outline-primary sudoku-choice ${modeSelect.value}`;
            button.textContent = symbol;
            button.addEventListener('click', () => setSelectedValue(index + 1));
            choices.appendChild(button);
        });

        const erase = document.createElement('button');
        erase.type = 'button';
        erase.className = 'btn btn-outline-secondary sudoku-choice';
        erase.innerHTML = '<i class="bi bi-eraser"></i>';
        erase.addEventListener('click', () => setSelectedValue(0));
        choices.appendChild(erase);
    }

    function selectCell(row, column) {
        selected = { row, column };
        refreshHighlights();
    }

    function refreshHighlights() {
        const cells = Array.from(board.querySelectorAll('.sudoku-cell'));
        cells.forEach(cell => {
            cell.classList.remove('selected', 'related', 'invalid');
            const row = Number(cell.dataset.row);
            const column = Number(cell.dataset.column);
            const value = values[row][column];

            if (selected && row === selected.row && column === selected.column) {
                cell.classList.add('selected');
            } else if (selected && isRelated(row, column, selected.row, selected.column)) {
                cell.classList.add('related');
            }

            if (value !== 0 && value !== currentMode.solution[row][column]) {
                cell.classList.add('invalid');
            }
        });
    }

    function isRelated(row, column, selectedRow, selectedColumn) {
        return row === selectedRow ||
            column === selectedColumn ||
            (getBoxStart(row) === getBoxStart(selectedRow) && getBoxStart(column) === getBoxStart(selectedColumn));
    }

    function setSelectedValue(value) {
        if (!selected || fixed[selected.row][selected.column]) {
            return;
        }

        values[selected.row][selected.column] = value;
        const cell = board.querySelector(`[data-row="${selected.row}"][data-column="${selected.column}"]`);
        if (cell) {
            cell.textContent = value ? currentMode.symbols[value - 1] : '';
            cell.classList.toggle('correct', value !== 0 && value === currentMode.solution[selected.row][selected.column]);
            setTimeout(() => cell.classList.remove('correct'), 200);
        }

        if (value !== 0 && value !== currentMode.solution[selected.row][selected.column]) {
            mistakes += 1;
            statusText.textContent = 'Popraw błędy';
        }

        updateStats();
        refreshHighlights();
        checkWin();
    }

    function updateStats() {
        const filled = values.flat().filter(value => value !== 0).length;
        filledCount.textContent = `${filled} / ${currentMode.size * currentMode.size}`;
        mistakesCount.textContent = String(mistakes);
    }

    function hasErrors() {
        return values.some((row, rowIndex) => row.some((value, columnIndex) => value !== 0 && value !== currentMode.solution[rowIndex][columnIndex]));
    }

    function isComplete() {
        return values.every((row, rowIndex) => row.every((value, columnIndex) => value === currentMode.solution[rowIndex][columnIndex]));
    }

    function checkWin() {
        if (isComplete()) {
            statusText.textContent = 'Wygrana!';
            setTimeout(() => alert('Brawo! Sudoku rozwiązane.'), 50);
        }
    }

    function checkGame() {
        if (isComplete()) {
            statusText.textContent = 'Wygrana!';
            alert('Wszystko się zgadza. Super robota!');
            return;
        }

        if (hasErrors()) {
            statusText.textContent = 'Są błędy';
            alert('Na planszy są pola do poprawy. Zaznaczyłem je na czerwono.');
            refreshHighlights();
            return;
        }

        statusText.textContent = 'Dobrze idzie';
        alert('Na razie nie widzę błędów. Uzupełnij resztę pól.');
    }

    document.addEventListener('keydown', event => {
        if (!selected) {
            return;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
            setSelectedValue(0);
            return;
        }

        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= currentMode.size) {
            setSelectedValue(digit);
        }
    });

    modeSelect.addEventListener('change', () => {
        updateDifficulties();
        startGame();
    });
    difficultySelect.addEventListener('change', startGame);
    newGameButton.addEventListener('click', startGame);
    checkButton.addEventListener('click', checkGame);

    updateDifficulties();
    startGame();
})();
