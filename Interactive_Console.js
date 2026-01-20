// Ultimate JavaScript Console - Fixed Display + Always LTR
(function() {
    'use strict';
    
    let consolePanel = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let isMinimized = false;
    let executionHistory = [];
    let historyIndex = -1;
    let lastSelectedElement = null;
    let savedSnippets = JSON.parse(localStorage.getItem('jsConsoleSnippets') || '[]');
    let savedOutputs = JSON.parse(localStorage.getItem('jsConsoleSavedOutputs') || '[]');
    let fontSize = parseInt(localStorage.getItem('jsConsoleFontSize') || '13');
    let autocompleteList = null;
    let autocompleteVisible = false;
    let currentOutputId = null;
    
    // Autocomplete suggestions
    const suggestions = [
        { text: '$x("//xpath")', desc: 'XPath query', category: 'selector' },
        { text: '$$("selector")', desc: 'querySelectorAll', category: 'selector' },
        { text: '$("selector")', desc: 'querySelector', category: 'selector' },
        { text: '$0', desc: 'Last selected element', category: 'selector' },
        { text: 'copy()', desc: 'Copy to clipboard', category: 'helper' },
        { text: 'clear()', desc: 'Clear console', category: 'helper' },
        { text: 'keys()', desc: 'Object keys', category: 'helper' },
        { text: 'values()', desc: 'Object values', category: 'helper' },
        { text: 'inspect()', desc: 'Highlight element', category: 'helper' },
        { text: 'profile()', desc: 'Measure performance', category: 'helper' },
        { text: 'getEventListeners()', desc: 'Get event listeners', category: 'helper' },
        { text: 'queryObjects()', desc: 'Find instances', category: 'helper' },
        { text: 'document.querySelector()', desc: 'Select element', category: 'dom' },
        { text: 'document.querySelectorAll()', desc: 'Select all elements', category: 'dom' },
        { text: 'document.getElementById()', desc: 'Get by ID', category: 'dom' },
        { text: 'console.log()', desc: 'Log to console', category: 'console' },
        { text: 'console.table()', desc: 'Display as table', category: 'console' },
        { text: 'JSON.stringify()', desc: 'Convert to JSON', category: 'json' },
        { text: 'JSON.parse()', desc: 'Parse JSON', category: 'json' }
    ];
    
    // Store original console methods
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };
    
    // DevTools helper functions
    const devToolsHelpers = {
        $x: function(xpath, context = document) {
            const result = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const nodes = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                nodes.push(result.snapshotItem(i));
            }
            return nodes;
        },
        $$: function(selector, context = document) {
            return Array.from((context || document).querySelectorAll(selector));
        },
        $: function(selector, context = document) {
            return (context || document).querySelector(selector);
        },
        get $0() { return lastSelectedElement; },
        clear: function() {
            const output = consolePanel?.querySelector('.console-output');
            if (output) output.innerHTML = '';
        },
        copy: function(value) {
            const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
            navigator.clipboard.writeText(text).then(() => console.log('✓ Copied to clipboard!'));
        },
        keys: function(obj) { return Object.keys(obj); },
        values: function(obj) { return Object.values(obj); },
        dir: function(obj) { console.log(obj); return obj; },
        getEventListeners: function(element) {
            const listeners = {};
            const events = ['click', 'mouseover', 'mouseout', 'keydown', 'keyup', 'change', 'submit'];
            events.forEach(event => {
                if (element[`on${event}`]) listeners[event] = element[`on${event}`];
            });
            return listeners;
        },
        monitor: function(fn) {
            const original = fn;
            return function(...args) {
                console.log(`Called with:`, args);
                const result = original.apply(this, args);
                console.log(`Returned:`, result);
                return result;
            };
        },
        profile: function(fn, ...args) {
            const start = performance.now();
            const result = fn(...args);
            const end = performance.now();
            console.log(`⏱️ Execution time: ${(end - start).toFixed(2)}ms`);
            return result;
        },
        queryObjects: function(constructor) {
            return Array.from(document.querySelectorAll('*')).filter(el => el instanceof constructor);
        },
        inspect: function(element) {
            if (element instanceof Element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.outline = '3px solid #ff6b6b';
                setTimeout(() => element.style.outline = '', 2000);
            }
        }
    };
    
    // Format date/time
    function formatDateTime() {
        const now = new Date();
        return now.toLocaleString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
    }
    
    // Notification system
    function showNotification(message, type = 'info') {
        const existingNotif = document.querySelector('.console-notification');
        if (existingNotif) existingNotif.remove();
        
        const colors = {
            'success': { bg: '#10b981', icon: '✓' },
            'info': { bg: '#3b82f6', icon: 'ℹ' },
            'warning': { bg: '#f59e0b', icon: '⚠' },
            'error': { bg: '#ef4444', icon: '✕' }
        };
        
        const config = colors[type] || colors['info'];
        
        const notif = document.createElement('div');
        notif.className = 'console-notification';
        notif.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: ${config.bg}; color: white;
            padding: 12px 20px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px; font-weight: 500; z-index: 1000002; animation: slideIn 0.3s ease-out;
            display: flex; align-items: center; gap: 8px; direction: ltr !important; text-align: left !important;
        `;
        
        notif.innerHTML = `<span style="font-size: 16px;">${config.icon}</span><span>${message}</span>`;
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
    
    // Add styles
    if (!document.querySelector('style[data-console-styles]')) {
        const style = document.createElement('style');
        style.setAttribute('data-console-styles', 'true');
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
            
            .floating-console-panel,
            .floating-console-panel * {
                direction: ltr !important;
                text-align: left !important;
                unicode-bidi: embed !important;
            }
            
            .console-output {
                overflow-y: auto !important;
                overflow-x: hidden !important;
                max-height: 100% !important;
                height: 100% !important;
            }
            
            .console-output::-webkit-scrollbar { width: 12px; }
            .console-output::-webkit-scrollbar-track { background: #1e1e1e; }
            .console-output::-webkit-scrollbar-thumb { 
                background: #555; 
                border-radius: 6px;
                border: 2px solid #1e1e1e;
            }
            .console-output::-webkit-scrollbar-thumb:hover { background: #777; }
            
            .snippets-container::-webkit-scrollbar,
            .saved-outputs-container::-webkit-scrollbar { width: 10px; }
            .snippets-container::-webkit-scrollbar-track,
            .saved-outputs-container::-webkit-scrollbar-track { background: #1e1e1e; }
            .snippets-container::-webkit-scrollbar-thumb,
            .saved-outputs-container::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
            
            .console-tab { 
                padding: 10px 20px; 
                cursor: pointer; 
                border-bottom: 3px solid transparent; 
                transition: all 0.2s;
                font-size: 13px;
                font-weight: 600;
            }
            .console-tab.active { 
                border-bottom-color: #667eea; 
                background: rgba(102, 126, 234, 0.15);
                color: #667eea;
            }
            .console-tab:hover { background: rgba(102, 126, 234, 0.1); }
            
            .expandable-item { cursor: pointer; user-select: none; }
            .expandable-item:hover { background: rgba(255, 255, 255, 0.05); }
            
            .snippet-item,
            .output-item { 
                padding: 12px; 
                margin: 6px 0; 
                background: #2d2d2d; 
                border-radius: 6px; 
                border: 2px solid transparent;
                transition: all 0.2s;
            }
            .snippet-item:hover,
            .output-item:hover { 
                background: #3e3e42;
                border-color: #667eea;
            }
            
            .execution-block {
                margin: 12px 8px;
                padding: 12px;
                background: #252526;
                border-radius: 6px;
                border-left: 3px solid #667eea;
            }
            
            .autocomplete-list {
                position: fixed;
                background: #252526;
                border: 1px solid #3e3e42;
                border-radius: 4px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000001;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                direction: ltr !important;
            }
            
            .autocomplete-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #2d2d2d;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .autocomplete-item:hover,
            .autocomplete-item.selected {
                background: #094771;
            }
            
            .autocomplete-item .text {
                color: #d4d4d4;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
            }
            
            .autocomplete-item .desc {
                color: #808080;
                font-size: 11px;
                margin-left: 12px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Escape HTML
    function escapeHtml(text) {
        if (typeof text !== 'string') text = String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Copy to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copied to clipboard! 📋', 'success');
        }).catch(() => {
            showNotification('Copy failed', 'error');
        });
    }
    
    // Format value with expandable objects
    function formatValue(value, depth = 0) {
        try {
            if (depth > 3) return '<span style="color:#808080">...</span>';
            if (value === null) return '<span style="color:#569cd6">null</span>';
            if (value === undefined) return '<span style="color:#569cd6">undefined</span>';
            if (typeof value === 'string') return `<span style="color:#ce9178">"${escapeHtml(value)}"</span>`;
            if (typeof value === 'number') return `<span style="color:#b5cea8">${value}</span>`;
            if (typeof value === 'boolean') return `<span style="color:#569cd6">${value}</span>`;
            if (typeof value === 'function') return `<span style="color:#dcdcaa">[Function: ${value.name || 'anonymous'}]</span>`;
            
            if (value instanceof Element) {
                const tag = value.tagName.toLowerCase();
                const id = value.id ? ` id="${escapeHtml(value.id)}"` : '';
                const cls = value.className ? ` class="${escapeHtml(String(value.className).substring(0, 50))}${value.className.length > 50 ? '...' : ''}"` : '';
                const text = value.innerText ? ` → "${escapeHtml(value.innerText.substring(0, 40))}${value.innerText.length > 40 ? '...' : ''}"` : '';
                return `<span style="color:#4ec9b0">&lt;${tag}${id}${cls}&gt;</span><span style="color:#808080">${text}</span>`;
            }
            
            if (Array.isArray(value)) {
                if (value.length === 0) return '<span style="color:#4ec9b0">[]</span>';
                
                if (value[0] instanceof Element) {
                    let output = `<span style="color:#4ec9b0">[${value.length} element${value.length !== 1 ? 's' : ''}]</span><br>`;
                    value.slice(0, 10).forEach((el, i) => {
                        const tag = el.tagName.toLowerCase();
                        const id = el.id ? ` id="${escapeHtml(el.id)}"` : '';
                        const cls = el.className ? ` class="${escapeHtml(String(el.className).substring(0, 30))}"` : '';
                        const text = el.innerText ? ` → "${escapeHtml(el.innerText.substring(0, 40))}${el.innerText.length > 40 ? '...' : ''}"` : '';
                        output += `  <span style="color:#808080">${i}:</span> <span style="color:#4ec9b0">&lt;${tag}${id}${cls}&gt;</span><span style="color:#808080">${text}</span><br>`;
                    });
                    if (value.length > 10) output += `  <span style="color:#808080">... ${value.length - 10} more</span>`;
                    return output;
                }
                
                const id = 'exp_' + Math.random().toString(36).substr(2, 9);
                const preview = `Array(${value.length})`;
                return `<span class="expandable-item" data-id="${id}">▶ <span style="color:#4ec9b0">${preview}</span></span>
                        <div id="${id}" style="display:none;margin-left:20px">${value.slice(0, 100).map((v, i) => 
                            `<span style="color:#808080">${i}:</span> ${formatValue(v, depth + 1)}`
                        ).join('<br>')}</div>`;
            }
            
            if (typeof value === 'object') {
                const keys = Object.keys(value);
                if (keys.length === 0) return '<span style="color:#4ec9b0">{}</span>';
                
                const id = 'exp_' + Math.random().toString(36).substr(2, 9);
                const preview = `Object {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
                return `<span class="expandable-item" data-id="${id}">▶ <span style="color:#4ec9b0">${escapeHtml(preview)}</span></span>
                        <div id="${id}" style="display:none;margin-left:20px">${keys.slice(0, 50).map(k => 
                            `<span style="color:#9cdcfe">${escapeHtml(k)}:</span> ${formatValue(value[k], depth + 1)}`
                        ).join('<br>')}</div>`;
            }
            
            return escapeHtml(String(value));
        } catch(e) {
            return `<span style="color:#f48771">[Error formatting value]</span>`;
        }
    }
    
    // Execute code
    function executeCode(code) {
        const output = consolePanel?.querySelector('.console-output');
        if (!output) return;
        
        if (code.trim()) {
            executionHistory.push(code);
            historyIndex = executionHistory.length;
        }
        
        const executionId = 'exec_' + Date.now();
        currentOutputId = executionId;
        const timestamp = formatDateTime();
        
        const executionBlock = document.createElement('div');
        executionBlock.className = 'execution-block';
        executionBlock.id = executionId;
        
        executionBlock.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #3e3e42">
                <div style="color:#808080;font-size:11px;font-family:'Consolas','Monaco',monospace">
                    🕒 ${escapeHtml(timestamp)}
                </div>
                <div style="display:flex;gap:6px">
                    <button class="copy-exec-btn" data-id="${executionId}" style="background:#667eea;color:white;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:600">📋 Copy</button>
                    <button class="save-exec-btn" data-id="${executionId}" style="background:#10b981;color:white;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:600">💾 Save</button>
                    <button class="delete-exec-btn" data-id="${executionId}" style="background:#ef4444;color:white;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:600">🗑️</button>
                </div>
            </div>
            <div class="exec-content"></div>
        `;
        
        output.appendChild(executionBlock);
        
        const execContent = executionBlock.querySelector('.exec-content');
        
        const inputEntry = document.createElement('div');
        inputEntry.style.cssText = `
            padding: 8px 10px; background: #1e1e1e; border-left: 3px solid #007acc;
            font-family: 'Consolas', 'Monaco', monospace; font-size: ${fontSize}px; color: #d4d4d4;
            margin-bottom: 8px; white-space: pre-wrap; word-break: break-word;
            border-radius:4px;
        `;
        inputEntry.innerHTML = `<span style="color:#569cd6">&gt;</span> ${escapeHtml(code)}`;
        execContent.appendChild(inputEntry);
        
        // Add button handlers
        executionBlock.querySelector('.copy-exec-btn').addEventListener('click', function() {
            const block = document.getElementById(this.getAttribute('data-id'));
            const text = block.querySelector('.exec-content').innerText;
            copyToClipboard(text);
        });
        
        executionBlock.querySelector('.save-exec-btn').addEventListener('click', function() {
            const block = document.getElementById(this.getAttribute('data-id'));
            const content = block.querySelector('.exec-content').innerHTML;
            const timestampDiv = block.querySelector('div > div');
            const timestamp = timestampDiv ? timestampDiv.textContent.replace('🕒 ', '') : formatDateTime();
            
            const name = prompt('Save output as:');
            if (!name) return;
            
            savedOutputs.push({ 
                name, 
                content, 
                code,
                timestamp,
                date: new Date().toISOString() 
            });
            localStorage.setItem('jsConsoleSavedOutputs', JSON.stringify(savedOutputs));
            showNotification(`Output "${name}" saved! 💾`, 'success');
            updateSavedOutputsTab();
            const outputsTab = consolePanel?.querySelector('[data-tab="outputs"]');
            if (outputsTab) outputsTab.textContent = `💾 Saved Outputs (${savedOutputs.length})`;
        });
        
        executionBlock.querySelector('.delete-exec-btn').addEventListener('click', function() {
            if (confirm('Delete this execution block?')) {
                const block = document.getElementById(this.getAttribute('data-id'));
                block.remove();
                showNotification('Execution deleted', 'info');
            }
        });
        
        let capturedLogs = [];
        const tempConsole = {
            log: (...args) => { capturedLogs.push({ type: 'log', args }); originalConsole.log.apply(console, args); },
            error: (...args) => { capturedLogs.push({ type: 'error', args }); originalConsole.error.apply(console, args); },
            warn: (...args) => { capturedLogs.push({ type: 'warn', args }); originalConsole.warn.apply(console, args); },
            info: (...args) => { capturedLogs.push({ type: 'info', args }); originalConsole.info.apply(console, args); }
        };
        
        console.log = tempConsole.log;
        console.error = tempConsole.error;
        console.warn = tempConsole.warn;
        console.info = tempConsole.info;
        
        const startTime = performance.now();
        
        try {
            const helperNames = Object.keys(devToolsHelpers);
            const helperValues = Object.values(devToolsHelpers);
            const $0 = lastSelectedElement;
            
            let wrappedCode = code.trim();
            const isExpression = !wrappedCode.match(/^(var|let|const|function|class|if|for|while|do|switch|try)\s/) 
                                && !wrappedCode.includes(';') 
                                && !wrappedCode.match(/\breturn\b/);
            
            if (isExpression) wrappedCode = `return ${wrappedCode}`;
            
            const func = new Function(...helperNames, '$0', wrappedCode);
            const result = func(...helperValues, $0);
            
            const endTime = performance.now();
            
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            
            capturedLogs.forEach(log => {
                const colors = { log: '#d4d4d4', error: '#f48771', warn: '#dcdcaa', info: '#4fc1ff' };
                const icons = { log: '›', error: '✕', warn: '⚠', info: 'ℹ' };
                const entry = document.createElement('div');
                entry.style.cssText = `padding: 4px 10px; font-family: 'Consolas', 'Monaco', monospace; font-size: ${fontSize}px; color: ${colors[log.type]}; line-height: 1.6;`;
                const message = log.args.map(arg => formatValue(arg)).join(' ');
                entry.innerHTML = `<span style="color:#808080;margin-right:8px">${icons[log.type]}</span>${message}`;
                execContent.appendChild(entry);
                
                // Add expandable handlers
                entry.querySelectorAll('.expandable-item').forEach(item => {
                    item.addEventListener('click', function() {
                        const targetId = this.getAttribute('data-id');
                        const target = document.getElementById(targetId);
                        if (target) {
                            const isExpanded = target.style.display !== 'none';
                            target.style.display = isExpanded ? 'none' : 'block';
                            this.innerHTML = this.innerHTML.replace(isExpanded ? '▼' : '▶', isExpanded ? '▶' : '▼');
                        }
                    });
                });
            });
            
            const resultEntry = document.createElement('div');
            resultEntry.style.cssText = `padding: 4px 10px; font-family: 'Consolas', 'Monaco', monospace; font-size: ${fontSize}px; color: #4ec9b0; line-height: 1.6;`;
            resultEntry.innerHTML = `<span style="color:#808080;margin-right:8px">←</span>${formatValue(result)}`;
            execContent.appendChild(resultEntry);
            
            // Add expandable handlers to result
            resultEntry.querySelectorAll('.expandable-item').forEach(item => {
                item.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-id');
                    const target = document.getElementById(targetId);
                    if (target) {
                        const isExpanded = target.style.display !== 'none';
                        target.style.display = isExpanded ? 'none' : 'block';
                        this.innerHTML = this.innerHTML.replace(isExpanded ? '▼' : '▶', isExpanded ? '▶' : '▼');
                    }
                });
            });
            
            const timeEntry = document.createElement('div');
            timeEntry.style.cssText = `padding: 4px 10px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; color: #808080;`;
            timeEntry.innerHTML = `⏱️ ${(endTime - startTime).toFixed(2)}ms`;
            execContent.appendChild(timeEntry);
            
            showNotification('Code executed! ✓', 'success');
            
        } catch(error) {
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            
            capturedLogs.forEach(log => {
                const colors = { log: '#d4d4d4', error: '#f48771', warn: '#dcdcaa', info: '#4fc1ff' };
                const icons = { log: '›', error: '✕', warn: '⚠', info: 'ℹ' };
                const entry = document.createElement('div');
                entry.style.cssText = `padding: 4px 10px; font-family: 'Consolas', 'Monaco', monospace; font-size: ${fontSize}px; color: ${colors[log.type]}; line-height: 1.6;`;
                const message = log.args.map(arg => formatValue(arg)).join(' ');
                entry.innerHTML = `<span style="color:#808080;margin-right:8px">${icons[log.type]}</span>${message}`;
                execContent.appendChild(entry);
            });
            
            const errorEntry = document.createElement('div');
            errorEntry.style.cssText = `padding: 4px 10px; font-family: 'Consolas', 'Monaco', monospace; font-size: ${fontSize}px; color: #f48771; line-height: 1.6;`;
            errorEntry.innerHTML = `<span style="color:#808080;margin-right:8px">✕</span>${escapeHtml(error.name)}: ${escapeHtml(error.message)}`;
            execContent.appendChild(errorEntry);
            
            showNotification('Execution error! ✕', 'error');
        }
        
        output.scrollTop = output.scrollHeight;
    }
    
    // Autocomplete functions
    function showAutocomplete(textarea) {
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastWord = textBeforeCursor.match(/[\w$]+$/);
        
        if (!lastWord) {
            hideAutocomplete();
            return;
        }
        
        const search = lastWord[0].toLowerCase();
        const filtered = suggestions.filter(s => 
            s.text.toLowerCase().startsWith(search) || 
            s.desc.toLowerCase().includes(search)
        );
        
        if (filtered.length === 0) {
            hideAutocomplete();
            return;
        }
        
        if (!autocompleteList) {
            autocompleteList = document.createElement('div');
            autocompleteList.className = 'autocomplete-list';
            document.body.appendChild(autocompleteList);
        }
        
        const rect = textarea.getBoundingClientRect();
        autocompleteList.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.bottom + 2}px;
            width: ${Math.min(400, rect.width)}px;
            max-height: 200px;
            background: #252526;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            overflow-y: auto;
            z-index: 1000001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            direction: ltr !important;
        `;
        
        autocompleteList.innerHTML = filtered.map((item, idx) => `
            <div class="autocomplete-item ${idx === 0 ? 'selected' : ''}" data-text="${escapeHtml(item.text)}" data-idx="${idx}">
                <span class="text">${escapeHtml(item.text)}</span>
                <span class="desc">${escapeHtml(item.desc)}</span>
            </div>
        `).join('');
        
        autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                insertAutocomplete(textarea, item.getAttribute('data-text'), lastWord[0]);
            });
            
            item.addEventListener('mouseenter', () => {
                autocompleteList.querySelectorAll('.autocomplete-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
        
        autocompleteVisible = true;
    }
    
    function hideAutocomplete() {
        if (autocompleteList) {
            autocompleteList.remove();
            autocompleteList = null;
        }
        autocompleteVisible = false;
    }
    
    function insertAutocomplete(textarea, text, replace) {
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;
        const before = value.substring(0, cursorPos - replace.length);
        const after = value.substring(cursorPos);
        
        textarea.value = before + text + after;
        textarea.selectionStart = textarea.selectionEnd = before.length + text.length;
        textarea.focus();
        hideAutocomplete();
    }
    
    // Save snippet
    function saveSnippet() {
        const code = consolePanel?.querySelector('.code-input').value.trim();
        if (!code) return showNotification('No code to save', 'warning');
        
        const name = prompt('Snippet name:');
        if (!name) return;
        
        savedSnippets.push({ name, code, date: new Date().toISOString() });
        localStorage.setItem('jsConsoleSnippets', JSON.stringify(savedSnippets));
        showNotification(`Snippet "${name}" saved! 💾`, 'success');
        updateSnippetsTab();
        
        const snippetsTab = consolePanel?.querySelector('[data-tab="snippets"]');
        if (snippetsTab) snippetsTab.textContent = `📚 Snippets (${savedSnippets.length})`;
    }
    
    // Update snippets tab
    function updateSnippetsTab() {
        const snippetsContainer = consolePanel?.querySelector('.snippets-container');
        if (!snippetsContainer) return;
        
        if (savedSnippets.length === 0) {
            snippetsContainer.innerHTML = `
                <div style="padding:40px;text-align:center;color:#808080">
                    <div style="font-size:48px;margin-bottom:16px">📝</div>
                    <div style="font-size:16px;margin-bottom:8px">No saved snippets yet</div>
                    <div style="font-size:13px">Click "💾 Save" to save your code for later</div>
                </div>
            `;
            return;
        }
        
        snippetsContainer.innerHTML = savedSnippets.map((snippet, idx) => `
            <div class="snippet-item" style="font-size:${fontSize}px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong style="color:#4ec9b0;font-size:14px">📌 ${escapeHtml(snippet.name)}</strong>
                    <div style="display:flex;gap:8px">
                        <button class="load-snippet-btn" data-idx="${idx}" style="background:#667eea;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">📂 Load</button>
                        <button class="delete-snippet-btn" data-idx="${idx}" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">🗑️</button>
                    </div>
                </div>
                <pre style="margin:0;padding:8px;background:#1e1e1e;border-radius:4px;color:#d4d4d4;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word">${escapeHtml(snippet.code)}</pre>
                <div style="margin-top:6px;color:#808080;font-size:11px">Saved: ${new Date(snippet.date).toLocaleString()}</div>
            </div>
        `).join('');
        
        snippetsContainer.querySelectorAll('.load-snippet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'));
                const codeInput = consolePanel.querySelector('.code-input');
                codeInput.value = savedSnippets[idx].code;
                codeInput.focus();
                
                consolePanel.querySelectorAll('.console-tab').forEach(t => t.classList.remove('active'));
                consolePanel.querySelector('[data-tab="console"]').classList.add('active');
                consolePanel.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = content.getAttribute('data-content') === 'console' ? 'flex' : 'none';
                });
                
                showNotification(`Snippet "${savedSnippets[idx].name}" loaded! 📝`, 'success');
            });
        });
        
        snippetsContainer.querySelectorAll('.delete-snippet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'));
                if (confirm(`Delete snippet "${savedSnippets[idx].name}"?`)) {
                    savedSnippets.splice(idx, 1);
                    localStorage.setItem('jsConsoleSnippets', JSON.stringify(savedSnippets));
                    updateSnippetsTab();
                    const snippetsTab = consolePanel?.querySelector('[data-tab="snippets"]');
                    if (snippetsTab) snippetsTab.textContent = `📚 Snippets (${savedSnippets.length})`;
                    showNotification('Snippet deleted', 'info');
                }
            });
        });
    }
    
    // Update saved outputs tab
    function updateSavedOutputsTab() {
        const outputsContainer = consolePanel?.querySelector('.saved-outputs-container');
        if (!outputsContainer) return;
        
        if (savedOutputs.length === 0) {
            outputsContainer.innerHTML = `
                <div style="padding:40px;text-align:center;color:#808080">
                    <div style="font-size:48px;margin-bottom:16px">💾</div>
                    <div style="font-size:16px;margin-bottom:8px">No saved outputs yet</div>
                    <div style="font-size:13px">Click "💾 Save" on any execution to save it</div>
                </div>
            `;
            return;
        }
        
        outputsContainer.innerHTML = savedOutputs.map((output, idx) => `
            <div class="output-item">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong style="color:#10b981;font-size:14px">💾 ${escapeHtml(output.name)}</strong>
                    <div style="display:flex;gap:8px">
                        <button class="view-output-btn" data-idx="${idx}" style="background:#667eea;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">👁️ View</button>
                        <button class="copy-saved-output-btn" data-idx="${idx}" style="background:#3b82f6;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">📋 Copy</button>
                        <button class="delete-output-btn" data-idx="${idx}" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">🗑️</button>
                    </div>
                </div>
                <div style="padding:8px;background:#1e1e1e;border-radius:4px;margin-bottom:6px">
                    <div style="color:#808080;font-size:11px;margin-bottom:4px">Code:</div>
                    <pre style="margin:0;color:#d4d4d4;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word">${escapeHtml(output.code)}</pre>
                </div>
                <div style="color:#808080;font-size:11px">
                    Executed: ${escapeHtml(output.timestamp)} | Saved: ${new Date(output.date).toLocaleString()}
                </div>
            </div>
        `).join('');
        
        outputsContainer.querySelectorAll('.view-output-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                const output = savedOutputs[idx];
                
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8); z-index: 1000003;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px; direction: ltr !important;
                `;
                
                modal.innerHTML = `
                    <div style="background:#1e1e1e;border-radius:8px;max-width:800px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;direction:ltr !important">
                        <div style="background:#667eea;color:white;padding:16px;display:flex;justify-content:space-between;align-items:center">
                            <strong>${escapeHtml(output.name)}</strong>
                            <button class="close-modal-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:6px 12px;border-radius:4px;cursor:pointer">✕ Close</button>
                        </div>
                        <div style="flex:1;overflow-y:auto;padding:16px;font-family:'Consolas','Monaco',monospace;font-size:13px;direction:ltr !important">
                            ${output.content}
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.remove();
                });
            });
        });
        
        outputsContainer.querySelectorAll('.copy-saved-output-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                const div = document.createElement('div');
                div.innerHTML = savedOutputs[idx].content;
                copyToClipboard(div.innerText);
            });
        });
        
        outputsContainer.querySelectorAll('.delete-output-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                if (confirm(`Delete saved output "${savedOutputs[idx].name}"?`)) {
                    savedOutputs.splice(idx, 1);
                    localStorage.setItem('jsConsoleSavedOutputs', JSON.stringify(savedOutputs));
                    updateSavedOutputsTab();
                    const outputsTab = consolePanel?.querySelector('[data-tab="outputs"]');
                    if (outputsTab) outputsTab.textContent = `💾 Saved Outputs (${savedOutputs.length})`;
                    showNotification('Output deleted', 'info');
                }
            });
        });
    }
    
    // Export output
    function exportOutput() {
        const output = consolePanel?.querySelector('.console-output');
        if (!output) return;
        
        const text = output.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-output-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Output exported! 📥', 'success');
    }
    
    // Create console panel
    function createConsolePanel() {
        if (consolePanel) {
            consolePanel.remove();
            consolePanel = null;
            return;
        }
        
        consolePanel = document.createElement('div');
        consolePanel.className = 'floating-console-panel';
        consolePanel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 900px; height: 650px; background: #1e1e1e; border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 1000000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex; flex-direction: column; overflow: hidden; 
            direction: ltr !important; text-align: left !important;
        `;
        
        let html = `
            <div class="console-header" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:12px 16px;font-weight:700;font-size:15px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none">
                <span>⚡ JavaScript Console Pro</span>
                <div style="display:flex;gap:8px">
                    <button class="font-minus-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">A-</button>
                    <button class="font-plus-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">A+</button>
                    <button class="minimize-console-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">_</button>
                    <button class="close-console-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">✕</button>
                </div>
            </div>
            
            <div style="display:flex;background:#252526;border-bottom:1px solid #3e3e42;color:#cccccc">
                <div class="console-tab active" data-tab="console">💻 Console</div>
                <div class="console-tab" data-tab="snippets">📚 Snippets (${savedSnippets.length})</div>
                <div class="console-tab" data-tab="outputs">💾 Saved Outputs (${savedOutputs.length})</div>
                <div class="console-tab" data-tab="helpers">📖 Helpers</div>
                <div class="console-tab" data-tab="settings">⚙️ Settings</div>
            </div>
            
            <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
                <div class="tab-content" data-content="console" style="flex:1;display:flex;flex-direction:column;overflow:hidden">
                    <div style="padding:12px;background:#252526;border-bottom:1px solid #3e3e42">
                        <div style="color:#cccccc;font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Code Editor <span style="color:#808080">(Ctrl+Space for autocomplete)</span></div>
                        <textarea class="code-input" placeholder="// Enter JavaScript code...
$x('//button')  // Find all buttons
$$('.class')    // querySelectorAll
$('#id')        // querySelector" style="width:100%;height:80px;background:#1e1e1e;border:1px solid #3e3e42;border-radius:4px;padding:10px;color:#d4d4d4;font-family:'Consolas','Monaco',monospace;font-size:${fontSize}px;resize:vertical;outline:none"></textarea>
                        <div style="display:flex;gap:8px;margin-top:8px">
                            <button class="execute-btn" style="flex:1;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:13px">▶ Execute (Ctrl+Enter)</button>
                            <button class="save-snippet-btn" style="background:#667eea;color:white;border:none;padding:10px 16px;border-radius:5px;cursor:pointer;font-weight:600;font-size:13px">💾 Save</button>
                            <button class="clear-input-btn" style="background:#374151;color:white;border:none;padding:10px 16px;border-radius:5px;cursor:pointer;font-weight:600;font-size:13px">🗑️</button>
                        </div>
                    </div>
                    
                    <div style="flex:1;display:flex;flex-direction:column;background:#1e1e1e;overflow:hidden;min-height:0">
                        <div style="padding:8px 12px;background:#252526;border-bottom:1px solid #3e3e42;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
                            <div style="color:#cccccc;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Output</div>
                            <div style="display:flex;gap:8px">
                                <button class="export-output-btn" style="background:#667eea;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">📥 Export</button>
                                <button class="clear-output-btn" style="background:#374151;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">Clear All</button>
                            </div>
                        </div>
                        <div class="console-output" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;background:#1e1e1e;padding:4px 0"></div>
                    </div>
                </div>
                
                <div class="tab-content snippets-container" data-content="snippets" style="flex:1;overflow-y:auto;padding:12px;display:none"></div>
                
                <div class="tab-content saved-outputs-container" data-content="outputs" style="flex:1;overflow-y:auto;padding:12px;display:none"></div>
                
                <div class="tab-content" data-content="helpers" style="flex:1;overflow-y:auto;padding:16px;display:none;line-height:1.8">
                    <h3 style="color:#4ec9b0;margin:0 0 16px 0">📚 DevTools Helpers</h3>
                    <div style="color:#d4d4d4;font-size:13px">
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">$x(xpath)</code> - Query elements by XPath</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">$$(selector)</code> - querySelectorAll</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">$(selector)</code> - querySelector</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">$0</code> - Last double-clicked element</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">copy(value)</code> - Copy to clipboard</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">clear()</code> - Clear console</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">keys(obj)</code> - Get object keys</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">values(obj)</code> - Get object values</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">inspect(element)</code> - Scroll to and highlight element</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">profile(fn, ...args)</code> - Measure execution time</div>
                        <div style="margin:8px 0"><code style="background:#2d2d2d;padding:2px 6px;border-radius:3px;color:#ce9178">getEventListeners(el)</code> - Get element event listeners</div>
                    </div>
                    
                    <h3 style="color:#4ec9b0;margin:24px 0 16px 0">⌨️ Keyboard Shortcuts</h3>
                    <div style="color:#d4d4d4;font-size:13px">
                        <div style="margin:8px 0"><kbd style="background:#2d2d2d;padding:4px 8px;border-radius:3px">Ctrl+Enter</kbd> - Execute code</div>
                        <div style="margin:8px 0"><kbd style="background:#2d2d2d;padding:4px 8px;border-radius:3px">Ctrl+Space</kbd> - Show autocomplete</div>
                        <div style="margin:8px 0"><kbd style="background:#2d2d2d;padding:4px 8px;border-radius:3px">Ctrl+↑</kbd> - Previous command</div>
                        <div style="margin:8px 0"><kbd style="background:#2d2d2d;padding:4px 8px;border-radius:3px">Ctrl+↓</kbd> - Next command</div>
                        <div style="margin:8px 0"><kbd style="background:#2d2d2d;padding:4px 8px;border-radius:3px">Tab</kbd> - Accept autocomplete</div>
                        <div style="margin:8px 0"><kbd style="background:#2d2d2d;padding:4px 8px;border-radius:3px">Esc</kbd> - Close autocomplete</div>
                    </div>
                </div>
                
                <div class="tab-content" data-content="settings" style="flex:1;overflow-y:auto;padding:16px;display:none">
                    <h3 style="color:#4ec9b0;margin:0 0 16px 0">⚙️ Settings</h3>
                    <div style="color:#d4d4d4;font-size:13px">
                        <div style="margin:16px 0">
                            <div style="margin-bottom:8px">Font Size: <span id="font-size-display">${fontSize}px</span></div>
                            <input type="range" class="font-size-slider" min="10" max="20" value="${fontSize}" style="width:100%">
                        </div>
                        <div style="margin:16px 0">
                            <button class="clear-history-btn" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-weight:600">Clear Command History</button>
                        </div>
                        <div style="margin:16px 0">
                            <button class="clear-snippets-btn" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-weight:600">Delete All Snippets</button>
                        </div>
                        <div style="margin:16px 0">
                            <button class="clear-saved-outputs-btn" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-weight:600">Delete All Saved Outputs</button>
                        </div>
                        <div style="margin:24px 0;padding:16px;background:#2d2d2d;border-radius:6px">
                            <div style="font-weight:600;margin-bottom:8px">Console Stats</div>
                            <div style="color:#808080;font-size:12px">
                                <div>Command History: ${executionHistory.length} items</div>
                                <div>Saved Snippets: ${savedSnippets.length} items</div>
                                <div>Saved Outputs: ${savedOutputs.length} items</div>
                                <div>Font Size: ${fontSize}px</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        consolePanel.innerHTML = html;
        document.body.appendChild(consolePanel);
        
        updateSnippetsTab();
        updateSavedOutputsTab();
        
        // Event listeners
        const header = consolePanel.querySelector('.console-header');
        const codeInput = consolePanel.querySelector('.code-input');
        const executeBtn = consolePanel.querySelector('.execute-btn');
        
        // Dragging
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = consolePanel.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            consolePanel.style.transform = 'none';
            e.preventDefault();
        });
        
        // Execute
        executeBtn.addEventListener('click', () => {
            const code = codeInput.value.trim();
            if (code) executeCode(code);
            else showNotification('Please enter some code', 'warning');
        });
        
        // Keyboard shortcuts
        codeInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                executeBtn.click();
            }
            
            if (e.ctrlKey && e.key === ' ') {
                e.preventDefault();
                showAutocomplete(codeInput);
            }
            
            if (e.key === 'Escape') {
                hideAutocomplete();
            }
            
            if (e.key === 'Tab' && autocompleteVisible) {
                e.preventDefault();
                const selected = autocompleteList?.querySelector('.autocomplete-item.selected');
                if (selected) selected.click();
            }
            
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && autocompleteVisible) {
                e.preventDefault();
                const items = Array.from(autocompleteList?.querySelectorAll('.autocomplete-item') || []);
                const currentIdx = items.findIndex(i => i.classList.contains('selected'));
                items[currentIdx]?.classList.remove('selected');
                
                let newIdx = e.key === 'ArrowDown' ? currentIdx + 1 : currentIdx - 1;
                if (newIdx < 0) newIdx = items.length - 1;
                if (newIdx >= items.length) newIdx = 0;
                
                items[newIdx]?.classList.add('selected');
                items[newIdx]?.scrollIntoView({ block: 'nearest' });
                return;
            }
            
            if (e.key === 'ArrowUp' && e.ctrlKey) {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    codeInput.value = executionHistory[historyIndex];
                }
            }
            if (e.key === 'ArrowDown' && e.ctrlKey) {
                e.preventDefault();
                if (historyIndex < executionHistory.length - 1) {
                    historyIndex++;
                    codeInput.value = executionHistory[historyIndex];
                } else {
                    historyIndex = executionHistory.length;
                    codeInput.value = '';
                }
            }
        });
        
        // Autocomplete on typing
        codeInput.addEventListener('input', () => {
            if (codeInput.value.length > 0) {
                showAutocomplete(codeInput);
            } else {
                hideAutocomplete();
            }
        });
        
        // Buttons
        consolePanel.querySelector('.clear-input-btn').addEventListener('click', () => {
            codeInput.value = '';
            codeInput.focus();
        });
        
        consolePanel.querySelector('.clear-output-btn').addEventListener('click', () => {
            if (confirm('Clear all output?')) {
                consolePanel.querySelector('.console-output').innerHTML = '';
            }
        });
        
        consolePanel.querySelector('.save-snippet-btn').addEventListener('click', saveSnippet);
        consolePanel.querySelector('.export-output-btn').addEventListener('click', exportOutput);
        
        consolePanel.querySelector('.minimize-console-btn').addEventListener('click', () => {
            const content = consolePanel.querySelector('.console-header').nextElementSibling.nextElementSibling;
            if (isMinimized) {
                content.style.display = 'flex';
                consolePanel.querySelector('.minimize-console-btn').textContent = '_';
                consolePanel.style.height = '650px';
                isMinimized = false;
            } else {
                content.style.display = 'none';
                consolePanel.querySelector('.minimize-console-btn').textContent = '□';
                consolePanel.style.height = 'auto';
                isMinimized = true;
            }
        });
        
        consolePanel.querySelector('.close-console-btn').addEventListener('click', () => {
            hideAutocomplete();
            consolePanel.remove();
            consolePanel = null;
        });
        
        // Font size controls
        consolePanel.querySelector('.font-minus-btn').addEventListener('click', () => {
            if (fontSize > 10) {
                fontSize--;
                localStorage.setItem('jsConsoleFontSize', fontSize);
                updateFontSize();
            }
        });
        
        consolePanel.querySelector('.font-plus-btn').addEventListener('click', () => {
            if (fontSize < 20) {
                fontSize++;
                localStorage.setItem('jsConsoleFontSize', fontSize);
                updateFontSize();
            }
        });
        
        consolePanel.querySelector('.font-size-slider')?.addEventListener('input', (e) => {
            fontSize = parseInt(e.target.value);
            localStorage.setItem('jsConsoleFontSize', fontSize);
            updateFontSize();
            const display = consolePanel.querySelector('#font-size-display');
            if (display) display.textContent = `${fontSize}px`;
        });
        
        consolePanel.querySelector('.clear-history-btn')?.addEventListener('click', () => {
            if (confirm('Clear command history?')) {
                executionHistory = [];
                historyIndex = -1;
                showNotification('History cleared', 'info');
            }
        });
        
        consolePanel.querySelector('.clear-snippets-btn')?.addEventListener('click', () => {
            if (confirm('Delete all snippets?')) {
                savedSnippets = [];
                localStorage.setItem('jsConsoleSnippets', '[]');
                updateSnippetsTab();
                const snippetsTab = consolePanel?.querySelector('[data-tab="snippets"]');
                if (snippetsTab) snippetsTab.textContent = `📚 Snippets (0)`;
                showNotification('Snippets deleted', 'info');
            }
        });
        
        consolePanel.querySelector('.clear-saved-outputs-btn')?.addEventListener('click', () => {
            if (confirm('Delete all saved outputs?')) {
                savedOutputs = [];
                localStorage.setItem('jsConsoleSavedOutputs', '[]');
                updateSavedOutputsTab();
                const outputsTab = consolePanel?.querySelector('[data-tab="outputs"]');
                if (outputsTab) outputsTab.textContent = `💾 Saved Outputs (0)`;
                showNotification('Saved outputs deleted', 'info');
            }
        });
        
        // Tab switching
        consolePanel.querySelectorAll('.console-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                consolePanel.querySelectorAll('.console-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.getAttribute('data-tab');
                consolePanel.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = content.getAttribute('data-content') === tabName ? 'flex' : 'none';
                });
            });
        });
        
        codeInput.focus();
    }
    
    function updateFontSize() {
        if (!consolePanel) return;
        const codeInput = consolePanel.querySelector('.code-input');
        if (codeInput) codeInput.style.fontSize = `${fontSize}px`;
    }
    
    // Mouse handlers
    document.addEventListener('mousemove', (e) => {
        if (isDragging && consolePanel) {
            const left = e.clientX - dragOffset.x;
            const top = e.clientY - dragOffset.y;
            consolePanel.style.left = `${Math.max(0, Math.min(window.innerWidth - consolePanel.offsetWidth, left))}px`;
            consolePanel.style.top = `${Math.max(0, Math.min(window.innerHeight - consolePanel.offsetHeight, top))}px`;
        }
    });
    
    document.addEventListener('mouseup', () => { isDragging = false; });
    
    // Click outside to hide autocomplete
    document.addEventListener('click', (e) => {
        if (autocompleteVisible && !e.target.closest('.code-input') && !e.target.closest('.autocomplete-list')) {
            hideAutocomplete();
        }
    });
    
    // Track $0
    document.addEventListener('dblclick', (e) => {
        if (!e.target.closest('.floating-console-panel')) {
            lastSelectedElement = e.target;
            originalConsole.log('💾 Element stored in $0:', e.target);
        }
    });
    
    // Create toggle button
    function createToggleButton() {
        if (document.getElementById('console-toggle-btn')) return;
        
        const button = document.createElement('button');
        button.id = 'console-toggle-btn';
        button.innerHTML = '⚡';
        button.title = 'JavaScript Console Pro';
        button.style.cssText = `
            position: fixed; bottom: 160px; right: 20px; width: 56px; height: 56px;
            border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; font-size: 28px; cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); z-index: 999998;
            transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;
            direction: ltr !important;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        
        button.addEventListener('click', createConsolePanel);
        document.body.appendChild(button);
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToggleButton);
    } else {
        createToggleButton();
    }
    
    console.log('✓ JavaScript Console Pro ready');
    showNotification('JS Console Pro ready! 🚀', 'success');
    
})();
