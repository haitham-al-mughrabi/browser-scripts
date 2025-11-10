(function() {
    async function copyTextToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {}
        }
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch {
            return false;
        }
    }

    function createPopup() {
        const existing = document.getElementById('token-message');
        if (existing) {
            document.body.removeChild(existing);
        }
        const container = document.createElement('div');
        container.id = 'token-message';
        Object.assign(container.style, {
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: '10000',
            backgroundColor: '#ffffff',
            padding: '25px 30px',
            borderRadius: '12px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: '16px',
            color: '#333',
            maxWidth: '400px',
            userSelect: 'text',
            boxSizing: 'border-box',
            maxHeight: '70vh',
            overflowY: 'auto',
        });
        return container;
    }

    function showKeyInput() {
        const container = createPopup();

        const instruction = document.createElement('div');
        instruction.textContent = 'Enter the localStorage key to retrieve:';
        instruction.style.marginBottom = '10px';

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Type or pick a key below...';
        Object.assign(keyInput.style, {
            width: '100%',
            padding: '10px 12px',
            border: '1.5px solid #ccc',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '15px',
            boxSizing: 'border-box',
            backgroundColor: '#f8f9fa',
            color: '#222',
        });

        // Clear button next to input
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear';
        Object.assign(clearButton.style, {
            padding: '6px 15px',
            marginLeft: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            borderRadius: '8px',
            border: '1.5px solid #ccc',
            backgroundColor: '#f5f5f5',
            color: '#555',
            verticalAlign: 'top',
            transition: 'background-color 0.3s ease',
        });
        clearButton.onmouseover = () => clearButton.style.backgroundColor = '#ddd';
        clearButton.onmouseout = () => clearButton.style.backgroundColor = '#f5f5f5';
        clearButton.onclick = () => {
            keyInput.value = '';
            valueInput.value = '';
            valueInput.style.display = 'none';
            copyButton.style.display = 'none';
            status.textContent = '';
            keyInput.focus();
        };

        // Wrap input and clear button
        const inputWrapper = document.createElement('div');
        inputWrapper.style.display = 'flex';
        inputWrapper.style.alignItems = 'center';
        inputWrapper.style.marginBottom = '15px';
        inputWrapper.appendChild(keyInput);
        inputWrapper.appendChild(clearButton);

        // Status message
        const status = document.createElement('div');
        status.style.fontSize = '14px';
        status.style.marginBottom = '15px';
        status.style.minHeight = '20px';

        // Container for value display area
        const valueContainer = document.createElement('div');
        valueContainer.style.marginBottom = '15px';

        // Copy button (hidden initially)
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy Value';
        Object.assign(copyButton.style, {
            padding: '8px 15px',
            backgroundColor: '#0078d7',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'none',
            transition: 'background-color 0.3s ease',
        });
        copyButton.onmouseover = () => copyButton.style.backgroundColor = '#005a9e';
        copyButton.onmouseout = () => copyButton.style.backgroundColor = '#0078d7';
        copyButton.onclick = () => {
            if (valueInput.value) {
                copyTextToClipboard(valueInput.value);
                status.textContent = '✅ Value copied to clipboard!';
                status.style.color = '#2b7a0b';
            }
        };

        // Input showing the retrieved value (readonly)
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.readOnly = true;
        Object.assign(valueInput.style, {
            width: '100%',
            padding: '10px 12px',
            border: '1.5px solid #ccc',
            borderRadius: '8px',
            fontSize: '16px',
            color: '#111',
            boxSizing: 'border-box',
            display: 'none',
            marginBottom: '8px',
            backgroundColor: '#f8f9fa',
        });

        valueContainer.appendChild(valueInput);
        valueContainer.appendChild(copyButton);

        // Buttons container
        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.justifyContent = 'flex-start';
        buttons.style.gap = '10px';

        // Retrieve button
        const retrieveButton = document.createElement('button');
        retrieveButton.textContent = 'Retrieve';
        Object.assign(retrieveButton.style, {
            padding: '8px 15px',
            backgroundColor: '#107c10',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
        });
        retrieveButton.onmouseover = () => retrieveButton.style.backgroundColor = '#0b5300';
        retrieveButton.onmouseout = () => retrieveButton.style.backgroundColor = '#107c10';

        retrieveButton.onclick = retrieveValue;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        Object.assign(closeButton.style, {
            padding: '8px 15px',
            backgroundColor: '#e1e1e1',
            color: '#333',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
        });
        closeButton.onmouseover = () => closeButton.style.backgroundColor = '#b5b5b5';
        closeButton.onmouseout = () => closeButton.style.backgroundColor = '#e1e1e1';
        closeButton.onclick = () => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        };

        buttons.appendChild(retrieveButton);
        buttons.appendChild(closeButton);

        // Suggestions container for dynamic keys
        const suggestionContainer = document.createElement('div');
        suggestionContainer.style.margin = '0 0 15px 0';

        const suggestionLabel = document.createElement('div');
        suggestionLabel.textContent = 'localStorage Keys:';
        suggestionLabel.style.fontSize = '13px';
        suggestionLabel.style.marginBottom = '6px';
        suggestionLabel.style.color = '#555';
        suggestionContainer.appendChild(suggestionLabel);

        // Fetch all keys from localStorage and create suggestion buttons
        const localStorageKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.trim() !== '') { // filter empty keys
                localStorageKeys.push(key);
            }
        }

        if (localStorageKeys.length === 0) {
            const noneMsg = document.createElement('div');
            noneMsg.textContent = 'No keys found in localStorage.';
            noneMsg.style.color = '#999';
            suggestionContainer.appendChild(noneMsg);
        } else {
            localStorageKeys.forEach(key => {
                const button = document.createElement('button');
                button.textContent = key;
                Object.assign(button.style, {
                    marginRight: '6px',
                    marginBottom: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    border: '1.5px solid #0078d7',
                    backgroundColor: '#e6f0fa',
                    color: '#0078d7',
                    userSelect: 'none',
                    transition: 'background-color 0.3s ease',
                });
                button.onmouseover = () => button.style.backgroundColor = '#cde0f7';
                button.onmouseout = () => button.style.backgroundColor = '#e6f0fa';
                button.onclick = () => {
                    keyInput.value = key;
                    retrieveValue();
                };
                suggestionContainer.appendChild(button);
            });
        }

        container.appendChild(instruction);
        container.appendChild(inputWrapper);
        container.appendChild(suggestionContainer);
        container.appendChild(status);
        container.appendChild(valueContainer);
        container.appendChild(buttons);

        document.body.appendChild(container);
        keyInput.focus();

        async function retrieveValue() {
            status.textContent = '';
            const key = keyInput.value.trim();
            if (!key) {
                status.textContent = '⚠️ Please enter a key.';
                status.style.color = '#cc6c00';
                valueInput.style.display = 'none';
                copyButton.style.display = 'none';
                return;
            }
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                valueInput.value = storedValue;
                valueInput.style.display = 'block';
                copyButton.style.display = 'inline-block';
                valueInput.select();
                // Auto copy value!
                const copied = await copyTextToClipboard(storedValue);
                status.textContent = copied ? '✅ Value copied to clipboard!' : 'Value found (could not auto copy).';
                status.style.color = copied ? '#2b7a0b' : '#cc6c00';
            } else {
                valueInput.style.display = 'none';
                copyButton.style.display = 'none';
                status.textContent = '⚠️ No value found for key: "' + key + '"';
                status.style.color = '#cc6c00';
            }
        }
    }

    showKeyInput();
})();
