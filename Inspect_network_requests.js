(function() {
    'use strict';
    
    const capturedRequests = [];
    let requestIdCounter = 0;
    let autoRefreshInterval = null;
    let selectedRequestId = null;
    
    // Section visibility settings
    const sectionSettings = {
        requestInfo: true,
        requestHeaders: true,
        requestBody: true,
        responseHeaders: true,
        responseBody: true
    };
    
    // Filter settings
    const filterSettings = {
        searchText: '',
        methods: {
            GET: true,
            POST: true,
            PUT: true,
            DELETE: true,
            PATCH: true,
            HEAD: true,
            OPTIONS: true
        },
        autoRefreshInterval: 2000
    };

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const requestId = ++requestIdCounter;
        const requestData = {
            id: requestId,
            method: 'GET',
            url: '',
            headers: {},
            body: null,
            timestamp: new Date().toISOString(),
            response: null,
            responseHeaders: {},
            status: null,
            type: 'fetch'
        };

        let url, options = {};
        if (typeof args[0] === 'string') {
            url = args[0];
            options = args[1] || {};
        } else if (args[0] instanceof Request) {
            url = args[0].url;
            options = {
                method: args[0].method,
                headers: args[0].headers,
                body: args[0].body
            };
        }

        requestData.url = url;
        requestData.method = options.method || 'GET';
        
        if (options.headers) {
            if (options.headers instanceof Headers) {
                for (let pair of options.headers.entries()) {
                    requestData.headers[pair[0]] = pair[1];
                }
            } else {
                requestData.headers = Object.assign({}, options.headers);
            }
        }

        if (options.body) {
            try {
                requestData.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            } catch (e) {
                requestData.body = '[Unable to serialize body]';
            }
        }

        capturedRequests.push(requestData);
        console.log('CAPTURED FETCH:', requestData.method, requestData.url);

        try {
            const response = await originalFetch(...args);
            const clonedResponse = response.clone();
            
            requestData.status = response.status;
            requestData.statusText = response.statusText;
            
            for (let pair of response.headers.entries()) {
                requestData.responseHeaders[pair[0]] = pair[1];
            }

            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    requestData.response = JSON.stringify(await clonedResponse.json(), null, 2);
                } else {
                    requestData.response = await clonedResponse.text();
                }
            } catch (e) {
                requestData.response = '[Unable to read response]';
            }

            return response;
        } catch (error) {
            requestData.response = 'Error: ' + error.message;
            requestData.status = 'Failed';
            throw error;
        }
    };

    const OriginalXMLHttpRequest = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new OriginalXMLHttpRequest();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        const originalSetRequestHeader = xhr.setRequestHeader;
        
        xhr._capturedRequest = null;

        xhr.open = function(method, url) {
            xhr._capturedRequest = {
                id: ++requestIdCounter,
                method: method,
                url: url,
                headers: {},
                body: null,
                timestamp: new Date().toISOString(),
                response: null,
                responseHeaders: {},
                status: null,
                type: 'xhr'
            };
            return originalOpen.apply(xhr, arguments);
        };

        xhr.setRequestHeader = function(header, value) {
            if (xhr._capturedRequest) {
                xhr._capturedRequest.headers[header] = value;
            }
            return originalSetRequestHeader.apply(xhr, arguments);
        };

        xhr.send = function(body) {
            if (xhr._capturedRequest) {
                if (body) {
                    try {
                        xhr._capturedRequest.body = typeof body === 'string' ? body : JSON.stringify(body);
                    } catch (e) {
                        xhr._capturedRequest.body = '[Unable to serialize body]';
                    }
                }

                capturedRequests.push(xhr._capturedRequest);
                console.log('CAPTURED XHR:', xhr._capturedRequest.method, xhr._capturedRequest.url);

                xhr.addEventListener('load', function() {
                    xhr._capturedRequest.status = xhr.status;
                    xhr._capturedRequest.statusText = xhr.statusText;
                    xhr._capturedRequest.response = xhr.responseText;
                    
                    const headerString = xhr.getAllResponseHeaders();
                    const headers = headerString.trim().split(/[\r\n]+/);
                    headers.forEach(function(line) {
                        const parts = line.split(': ');
                        const header = parts.shift();
                        const value = parts.join(': ');
                        if (header) {
                            xhr._capturedRequest.responseHeaders[header] = value;
                        }
                    });
                });

                xhr.addEventListener('error', function() {
                    xhr._capturedRequest.status = 'Failed';
                    xhr._capturedRequest.response = 'Network Error';
                });
            }
            return originalSend.apply(xhr, arguments);
        };

        return xhr;
    };

    async function copyTextToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.log('Clipboard API failed:', e);
            }
        }
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (e) {
            return false;
        }
    }

    function generateCurl(request) {
        let curl = 'curl -X ' + request.method + " '" + request.url + "'";
        
        for (let key in request.headers) {
            if (request.headers.hasOwnProperty(key)) {
                curl += " \\\n  -H '" + key + ": " + request.headers[key] + "'";
            }
        }
        
        if (request.body) {
            curl += " \\\n  -d '" + request.body.replace(/'/g, "\\'") + "'";
        }
        
        return curl;
    }

    function formatTime(isoString) {
        const date = new Date(isoString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return hours + ':' + minutes + ':' + seconds;
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown;
        handle.style.cursor = 'move';

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + 'px';
            element.style.left = (element.offsetLeft - pos1) + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function createSectionCard(title, content, color = '#0078d7') {
        const card = document.createElement('div');
        Object.assign(card.style, {
            marginBottom: '12px',
            border: '2px solid ' + color,
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#fff'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '8px 12px',
            backgroundColor: color,
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });
        header.textContent = title;

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy';
        copyBtn.title = 'Copy to clipboard';
        Object.assign(copyBtn.style, {
            padding: '4px 8px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 'bold'
        });
        copyBtn.onmouseover = function() { copyBtn.style.backgroundColor = 'rgba(255,255,255,0.3)'; };
        copyBtn.onmouseout = function() { copyBtn.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
        copyBtn.onclick = function() {
            copyTextToClipboard(content);
            copyBtn.textContent = '✓ Copied';
            setTimeout(function() { copyBtn.textContent = '📋 Copy'; }, 1500);
        };
        header.appendChild(copyBtn);

        const contentDiv = document.createElement('pre');
        Object.assign(contentDiv.style, {
            padding: '12px',
            margin: '0',
            backgroundColor: '#f9f9f9',
            fontSize: '11px',
            fontFamily: 'Consolas, Monaco, monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            maxHeight: '180px',
            overflow: 'auto',
            color: '#333'
        });
        contentDiv.textContent = content;

        card.appendChild(header);
        card.appendChild(contentDiv);
        return card;
    }

    function filterRequests(requests) {
        return requests.filter(function(req) {
            // Filter by method
            if (!filterSettings.methods[req.method]) {
                return false;
            }
            
            // Filter by search text
            if (filterSettings.searchText) {
                const searchLower = filterSettings.searchText.toLowerCase();
                const urlMatch = req.url.toLowerCase().includes(searchLower);
                const methodMatch = req.method.toLowerCase().includes(searchLower);
                const statusMatch = String(req.status).includes(searchLower);
                
                if (!urlMatch && !methodMatch && !statusMatch) {
                    return false;
                }
            }
            
            return true;
        });
    }

    function showRequestViewer() {
        const existing = document.getElementById('request-viewer');
        if (existing) {
            if (existing.style.display === 'none') {
                existing.style.display = 'flex';
            } else {
                existing.style.display = 'none';
            }
            return;
        }

        const container = document.createElement('div');
        container.id = 'request-viewer';
        Object.assign(container.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10000',
            backgroundColor: '#ffffff',
            padding: '0',
            borderRadius: '12px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: '14px',
            color: '#333',
            width: '750px',
            minWidth: '400px',
            minHeight: '400px',
            maxHeight: '85vh',
            overflow: 'hidden',
            boxSizing: 'border-box',
            resize: 'both',
            display: 'flex',
            flexDirection: 'column'
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .section-toggle-checkbox {
                margin-right: 5px;
                cursor: pointer;
            }
            
            .section-toggle-label {
                cursor: pointer;
                user-select: none;
                font-size: 12px;
                color: #555;
                display: flex;
                align-items: center;
            }
            
            .section-toggle-label:hover {
                color: #0078d7;
            }
            
            .collapse-header {
                cursor: pointer;
                user-select: none;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .collapse-icon {
                transition: transform 0.3s ease;
                display: inline-block;
            }
            
            .collapse-icon.collapsed {
                transform: rotate(-90deg);
            }
            
            #request-viewer input[type="text"],
            #request-viewer input[type="number"] {
                padding: 6px 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                font-family: inherit;
                background-color: #fff !important;
                color: #333 !important;
            }
            
            #request-viewer input[type="text"]:focus,
            #request-viewer input[type="number"]:focus {
                outline: none;
                border-color: #0078d7;
                background-color: #fff !important;
            }
            
            .request-item-selected {
                background-color: #cce4f7 !important;
                border-color: #0078d7 !important;
                border-width: 2px !important;
            }
            
            .area-label {
                font-size: 11px;
                font-weight: bold;
                color: #0078d7;
                margin-bottom: 6px;
                padding: 4px 8px;
                background-color: #e6f0fa;
                border-radius: 4px;
                border-left: 3px solid #0078d7;
            }
        `;
        document.head.appendChild(style);

        const header = document.createElement('div');
        header.id = 'request-viewer-header';
        Object.assign(header.style, {
            padding: '15px 20px',
            backgroundColor: '#0078d7',
            color: '#fff',
            borderRadius: '12px 12px 0 0',
            fontWeight: 'bold',
            fontSize: '16px',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: '0'
        });

        const titleText = document.createElement('span');
        titleText.id = 'request-viewer-title';
        titleText.textContent = 'XHR/Fetch Monitor (' + capturedRequests.length + ')';

        const headerButtons = document.createElement('div');
        Object.assign(headerButtons.style, {
            display: 'flex',
            gap: '10px',
            alignItems: 'center'
        });

        const minimizeButton = document.createElement('button');
        minimizeButton.textContent = '−';
        minimizeButton.title = 'Minimize';
        Object.assign(minimizeButton.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 8px',
            lineHeight: '1',
            fontWeight: 'bold'
        });
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.title = 'Hide';
        Object.assign(closeButton.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '28px',
            cursor: 'pointer',
            padding: '0 8px',
            lineHeight: '1'
        });
        closeButton.onclick = function() {
            container.style.display = 'none';
        };

        headerButtons.appendChild(minimizeButton);
        headerButtons.appendChild(closeButton);
        header.appendChild(titleText);
        header.appendChild(headerButtons);

        const content = document.createElement('div');
        content.id = 'request-viewer-content';
        Object.assign(content.style, {
            padding: '15px',
            overflow: 'auto',
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0'
        });

        // Search bar with label
        const searchLabel = document.createElement('div');
        searchLabel.className = 'area-label';
        searchLabel.textContent = '🔍 Search & Filter';
        
        const searchContainer = document.createElement('div');
        Object.assign(searchContainer.style, {
            marginBottom: '10px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexShrink: '0'
        });

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search URL, method, status...';
        Object.assign(searchInput.style, {
            flex: '1',
            padding: '8px 12px',
            border: '2px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px',
            backgroundColor: '#fff',
            color: '#333'
        });
        
        searchInput.oninput = function() {
            filterSettings.searchText = this.value;
            renderRequests();
        };

        const clearSearchBtn = document.createElement('button');
        clearSearchBtn.textContent = '✗ Clear';
        clearSearchBtn.title = 'Clear search';
        Object.assign(clearSearchBtn.style, {
            padding: '8px 16px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            flexShrink: '0',
            fontWeight: 'bold',
            minWidth: '80px'
        });
        clearSearchBtn.onclick = function() {
            searchInput.value = '';
            filterSettings.searchText = '';
            renderRequests();
        };

        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(clearSearchBtn);

        // Control bar with label
        const controlLabel = document.createElement('div');
        controlLabel.className = 'area-label';
        controlLabel.textContent = '⚙️ Controls';
        controlLabel.style.marginTop = '10px';

        const controlBar = document.createElement('div');
        Object.assign(controlBar.style, {
            marginBottom: '10px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: '0'
        });

        const autoRefreshCheckbox = document.createElement('input');
        autoRefreshCheckbox.type = 'checkbox';
        autoRefreshCheckbox.id = 'auto-refresh-checkbox';
        autoRefreshCheckbox.checked = true;
        autoRefreshCheckbox.style.cursor = 'pointer';
        autoRefreshCheckbox.style.flexShrink = '0';

        const autoRefreshLabel = document.createElement('label');
        autoRefreshLabel.setAttribute('for', 'auto-refresh-checkbox');
        autoRefreshLabel.textContent = 'Auto';
        autoRefreshLabel.style.cursor = 'pointer';
        autoRefreshLabel.style.fontSize = '12px';
        autoRefreshLabel.style.flexShrink = '0';

        const refreshIntervalInput = document.createElement('input');
        refreshIntervalInput.type = 'number';
        refreshIntervalInput.min = '500';
        refreshIntervalInput.max = '10000';
        refreshIntervalInput.step = '500';
        refreshIntervalInput.value = filterSettings.autoRefreshInterval;
        Object.assign(refreshIntervalInput.style, {
            width: '65px',
            padding: '4px 6px',
            fontSize: '12px',
            backgroundColor: '#fff',
            color: '#333',
            flexShrink: '0'
        });
        refreshIntervalInput.title = 'Auto-refresh interval (ms)';

        refreshIntervalInput.onchange = function() {
            const value = parseInt(this.value);
            if (value >= 500 && value <= 10000) {
                filterSettings.autoRefreshInterval = value;
                if (autoRefreshCheckbox.checked) {
                    if (autoRefreshInterval) {
                        clearInterval(autoRefreshInterval);
                    }
                    autoRefreshInterval = setInterval(function() {
                        renderRequests();
                    }, filterSettings.autoRefreshInterval);
                }
            }
        };

        const msLabel = document.createElement('span');
        msLabel.textContent = 'ms';
        msLabel.style.fontSize = '11px';
        msLabel.style.flexShrink = '0';

        const refreshButton = document.createElement('button');
        refreshButton.textContent = '🔄 Refresh';
        refreshButton.title = 'Refresh list';
        Object.assign(refreshButton.style, {
            padding: '8px 16px',
            backgroundColor: '#107c10',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            flexShrink: '0',
            fontWeight: 'bold',
            minWidth: '100px'
        });
        refreshButton.onmouseover = function() { refreshButton.style.backgroundColor = '#0b5300'; };
        refreshButton.onmouseout = function() { refreshButton.style.backgroundColor = '#107c10'; };

        const clearButton = document.createElement('button');
        clearButton.textContent = '🗑️ Clear All';
        clearButton.title = 'Clear all requests';
        Object.assign(clearButton.style, {
            padding: '8px 16px',
            backgroundColor: '#d13438',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            flexShrink: '0',
            fontWeight: 'bold',
            minWidth: '100px'
        });
        clearButton.onmouseover = function() { clearButton.style.backgroundColor = '#a02c2f'; };
        clearButton.onmouseout = function() { clearButton.style.backgroundColor = '#d13438'; };

        controlBar.appendChild(autoRefreshCheckbox);
        controlBar.appendChild(autoRefreshLabel);
        controlBar.appendChild(refreshIntervalInput);
        controlBar.appendChild(msLabel);
        controlBar.appendChild(refreshButton);
        controlBar.appendChild(clearButton);

        // Options panel - COLLAPSIBLE
        const optionsContainer = document.createElement('div');
        Object.assign(optionsContainer.style, {
            marginBottom: '10px',
            padding: '0',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            border: '1px solid #ddd',
            overflow: 'hidden',
            flexShrink: '0'
        });

        const optionsHeader = document.createElement('div');
        optionsHeader.className = 'collapse-header';
        Object.assign(optionsHeader.style, {
            padding: '8px 12px',
            backgroundColor: '#e8e8e8',
            borderBottom: '1px solid #ddd'
        });

        const optionsTitle = document.createElement('div');
        optionsTitle.innerHTML = '<strong>⚙️ Filters & Options</strong>';
        optionsTitle.style.fontSize = '11px';
        optionsTitle.style.color = '#333';

        const optionsCollapseIcon = document.createElement('span');
        optionsCollapseIcon.className = 'collapse-icon collapsed';
        optionsCollapseIcon.textContent = '▼';
        optionsCollapseIcon.style.fontSize = '10px';
        optionsCollapseIcon.style.color = '#666';

        optionsHeader.appendChild(optionsTitle);
        optionsHeader.appendChild(optionsCollapseIcon);

        const optionsContent = document.createElement('div');
        Object.assign(optionsContent.style, {
            padding: '10px',
            display: 'none',
            maxHeight: '200px',
            overflow: 'auto'
        });

        // HTTP Methods Filter
        const methodsFilterTitle = document.createElement('div');
        methodsFilterTitle.innerHTML = '<strong>🔀 HTTP Methods:</strong>';
        methodsFilterTitle.style.marginBottom = '6px';
        methodsFilterTitle.style.fontSize = '10px';
        methodsFilterTitle.style.color = '#333';

        const methodsGrid = document.createElement('div');
        Object.assign(methodsGrid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
            gap: '5px',
            marginBottom: '8px'
        });

        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        methods.forEach(function(method) {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.className = 'section-toggle-label';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'section-toggle-checkbox';
            checkbox.checked = filterSettings.methods[method] !== undefined ? filterSettings.methods[method] : true;
            checkbox.dataset.method = method;

            checkbox.onchange = function() {
                filterSettings.methods[method] = this.checked;
                renderRequests();
            };

            const labelText = document.createTextNode(method);

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(labelText);
            methodsGrid.appendChild(checkboxWrapper);
        });

        const methodButtons = document.createElement('div');
        Object.assign(methodButtons.style, {
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            gap: '5px'
        });

        const selectAllMethodsBtn = document.createElement('button');
        selectAllMethodsBtn.textContent = '✓ All Methods';
        Object.assign(selectAllMethodsBtn.style, {
            padding: '6px 12px',
            backgroundColor: '#0078d7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            flex: '1'
        });
        selectAllMethodsBtn.onclick = function() {
            methods.forEach(function(method) {
                filterSettings.methods[method] = true;
            });
            document.querySelectorAll('input[data-method]').forEach(function(cb) {
                cb.checked = true;
            });
            renderRequests();
        };

        const deselectAllMethodsBtn = document.createElement('button');
        deselectAllMethodsBtn.textContent = '✗ None';
        Object.assign(deselectAllMethodsBtn.style, {
            padding: '6px 12px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            flex: '1'
        });
        deselectAllMethodsBtn.onclick = function() {
            methods.forEach(function(method) {
                filterSettings.methods[method] = false;
            });
            document.querySelectorAll('input[data-method]').forEach(function(cb) {
                cb.checked = false;
            });
            renderRequests();
        };

        methodButtons.appendChild(selectAllMethodsBtn);
        methodButtons.appendChild(deselectAllMethodsBtn);

        // Section visibility
        const sectionVisibilityTitle = document.createElement('div');
        sectionVisibilityTitle.innerHTML = '<strong>👁️ Detail Sections:</strong>';
        sectionVisibilityTitle.style.marginBottom = '6px';
        sectionVisibilityTitle.style.fontSize = '10px';
        sectionVisibilityTitle.style.color = '#333';

        const checkboxGrid = document.createElement('div');
        Object.assign(checkboxGrid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '5px',
            marginBottom: '6px'
        });

        const sections = [
            { key: 'requestInfo', label: 'Request Info' },
            { key: 'requestHeaders', label: 'Request Headers' },
            { key: 'requestBody', label: 'Request Body' },
            { key: 'responseHeaders', label: 'Response Headers' },
            { key: 'responseBody', label: 'Response Body' }
        ];

        sections.forEach(function(section) {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.className = 'section-toggle-label';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'section-toggle-checkbox';
            checkbox.checked = sectionSettings[section.key];
            checkbox.dataset.sectionKey = section.key;

            checkbox.onchange = function() {
                sectionSettings[section.key] = this.checked;
                const selectedReq = detailsContainer.dataset.selectedRequest;
                if (selectedReq) {
                    const req = capturedRequests.find(r => r.id === parseInt(selectedReq));
                    if (req) showRequestDetails(req);
                }
            };

            const labelText = document.createTextNode(section.label);

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(labelText);
            checkboxGrid.appendChild(checkboxWrapper);
        });

        const selectButtonsContainer = document.createElement('div');
        Object.assign(selectButtonsContainer.style, {
            display: 'flex',
            gap: '5px'
        });

        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = '✓ All Sections';
        Object.assign(selectAllBtn.style, {
            padding: '6px 12px',
            backgroundColor: '#0078d7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            flex: '1'
        });
        selectAllBtn.onclick = function() {
            document.querySelectorAll('.section-toggle-checkbox').forEach(function(cb) {
                if (cb.dataset.sectionKey) {
                    cb.checked = true;
                    sectionSettings[cb.dataset.sectionKey] = true;
                }
            });
            const selectedReq = detailsContainer.dataset.selectedRequest;
            if (selectedReq) {
                const req = capturedRequests.find(r => r.id === parseInt(selectedReq));
                if (req) showRequestDetails(req);
            }
        };

        const deselectAllBtn = document.createElement('button');
        deselectAllBtn.textContent = '✗ None';
        Object.assign(deselectAllBtn.style, {
            padding: '6px 12px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            flex: '1'
        });
        deselectAllBtn.onclick = function() {
            document.querySelectorAll('.section-toggle-checkbox').forEach(function(cb) {
                if (cb.dataset.sectionKey) {
                    cb.checked = false;
                    sectionSettings[cb.dataset.sectionKey] = false;
                }
            });
            const selectedReq = detailsContainer.dataset.selectedRequest;
            if (selectedReq) {
                const req = capturedRequests.find(r => r.id === parseInt(selectedReq));
                if (req) showRequestDetails(req);
            }
        };

        selectButtonsContainer.appendChild(selectAllBtn);
        selectButtonsContainer.appendChild(deselectAllBtn);

        optionsContent.appendChild(methodsFilterTitle);
        optionsContent.appendChild(methodsGrid);
        optionsContent.appendChild(methodButtons);
        optionsContent.appendChild(sectionVisibilityTitle);
        optionsContent.appendChild(checkboxGrid);
        optionsContent.appendChild(selectButtonsContainer);

        optionsContainer.appendChild(optionsHeader);
        optionsContainer.appendChild(optionsContent);

        optionsHeader.onclick = function() {
            if (optionsContent.style.display === 'none') {
                optionsContent.style.display = 'block';
                optionsCollapseIcon.classList.remove('collapsed');
            } else {
                optionsContent.style.display = 'none';
                optionsCollapseIcon.classList.add('collapsed');
            }
        };

        // Request list with label
        const listLabel = document.createElement('div');
        listLabel.className = 'area-label';
        listLabel.textContent = '📋 Request List';
        listLabel.style.marginTop = '10px';

        const listContainer = document.createElement('div');
        Object.assign(listContainer.style, {
            height: '180px',
            overflowY: 'auto',
            marginBottom: '10px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '8px',
            backgroundColor: '#f9f9f9',
            flexShrink: '0'
        });

        // Details with label
        const detailsLabel = document.createElement('div');
        detailsLabel.className = 'area-label';
        detailsLabel.textContent = '📄 Request Details';
        detailsLabel.id = 'details-label';

        const detailsContainer = document.createElement('div');
        Object.assign(detailsContainer.style, {
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '12px',
            backgroundColor: '#fafafa',
            overflow: 'auto',
            flex: '1',
            minHeight: '0'
        });

        const statusMsg = document.createElement('div');
        Object.assign(statusMsg.style, {
            fontSize: '11px',
            marginTop: '8px',
            minHeight: '16px',
            flexShrink: '0'
        });

        function renderRequests() {
            listContainer.innerHTML = '';
            detailsContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">Select a request to view details</div>';
            
            const filteredRequests = filterRequests(capturedRequests);
            titleText.textContent = 'XHR/Fetch Monitor (' + filteredRequests.length + '/' + capturedRequests.length + ')';

            if (capturedRequests.length === 0) {
                listContainer.innerHTML = '<div style="color: #999; padding: 10px;">No requests captured yet.<br><br>Requests will appear here automatically.</div>';
                return;
            }
            
            if (filteredRequests.length === 0) {
                listContainer.innerHTML = '<div style="color: #ff8c00; padding: 10px;">No requests match the current filters.<br><br>Try adjusting your search or method filters.</div>';
                return;
            }

            const reversedRequests = filteredRequests.slice().reverse();
            
            reversedRequests.forEach(function(req, index) {
                const requestItem = document.createElement('div');
                requestItem.dataset.requestId = req.id;
                Object.assign(requestItem.style, {
                    padding: '6px 8px',
                    marginBottom: '5px',
                    backgroundColor: '#fff',
                    border: '1.5px solid #ddd',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                });

                // Add selected class if this is the selected request
                if (selectedRequestId === req.id) {
                    requestItem.classList.add('request-item-selected');
                }

                requestItem.onmouseover = function() {
                    if (!this.classList.contains('request-item-selected')) {
                        requestItem.style.backgroundColor = '#e6f0fa';
                        requestItem.style.borderColor = '#0078d7';
                    }
                };
                requestItem.onmouseout = function() {
                    if (!this.classList.contains('request-item-selected')) {
                        requestItem.style.backgroundColor = '#fff';
                        requestItem.style.borderColor = '#ddd';
                    }
                };

                // Selection icon
                const selectionIcon = document.createElement('span');
                selectionIcon.textContent = selectedRequestId === req.id ? '👉' : '⚪';
                selectionIcon.style.fontSize = '14px';
                selectionIcon.style.flexShrink = '0';

                const methodBadge = document.createElement('span');
                methodBadge.textContent = req.method;
                Object.assign(methodBadge.style, {
                    display: 'inline-block',
                    padding: '2px 6px',
                    backgroundColor: getMethodColor(req.method),
                    color: '#fff',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    flexShrink: '0'
                });

                const typeBadge = document.createElement('span');
                typeBadge.textContent = req.type.toUpperCase();
                Object.assign(typeBadge.style, {
                    display: 'inline-block',
                    padding: '2px 5px',
                    backgroundColor: req.type === 'fetch' ? '#8764b8' : '#ff8c00',
                    color: '#fff',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    flexShrink: '0'
                });

                const urlText = document.createElement('span');
                urlText.textContent = truncateUrl(req.url, 30);
                urlText.style.fontSize = '11px';
                urlText.style.flex = '1';
                urlText.style.overflow = 'hidden';
                urlText.style.textOverflow = 'ellipsis';
                urlText.style.whiteSpace = 'nowrap';

                const statusBadge = document.createElement('span');
                statusBadge.textContent = req.status || 'Pending';
                Object.assign(statusBadge.style, {
                    display: 'inline-block',
                    padding: '2px 6px',
                    backgroundColor: getStatusColor(req.status),
                    color: '#fff',
                    borderRadius: '3px',
                    fontSize: '9px',
                    flexShrink: '0'
                });

                const timeText = document.createElement('span');
                timeText.textContent = formatTime(req.timestamp);
                Object.assign(timeText.style, {
                    fontSize: '9px',
                    color: '#666',
                    fontFamily: 'monospace',
                    flexShrink: '0'
                });

                requestItem.appendChild(selectionIcon);
                requestItem.appendChild(methodBadge);
                requestItem.appendChild(typeBadge);
                requestItem.appendChild(urlText);
                requestItem.appendChild(statusBadge);
                requestItem.appendChild(timeText);

                requestItem.onclick = function() { 
                    selectedRequestId = req.id;
                    // Remove selected class from all items
                    document.querySelectorAll('.request-item-selected').forEach(function(item) {
                        item.classList.remove('request-item-selected');
                        item.style.backgroundColor = '#fff';
                        item.style.borderColor = '#ddd';
                        item.style.borderWidth = '1.5px';
                        item.querySelector('span').textContent = '⚪';
                    });
                    // Add selected class to this item
                    this.classList.add('request-item-selected');
                    this.querySelector('span').textContent = '👉';
                    showRequestDetails(req);
                };
                
                listContainer.appendChild(requestItem);

                if (index === 0 && !selectedRequestId) {
                    setTimeout(function() { 
                        selectedRequestId = req.id;
                        requestItem.classList.add('request-item-selected');
                        selectionIcon.textContent = '👉';
                        showRequestDetails(req);
                    }, 100);
                }
            });
        }

        function showRequestDetails(request) {
            detailsContainer.innerHTML = '';
            detailsContainer.dataset.selectedRequest = request.id;
            
            // Update details label
            const detailsLabelElem = document.getElementById('details-label');
            if (detailsLabelElem) {
                detailsLabelElem.textContent = '📄 Request Details - ' + request.method + ' (ID: ' + request.id + ')';
            }

            const buttonContainer = document.createElement('div');
            Object.assign(buttonContainer.style, {
                marginBottom: '12px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
            });

            const buttons = [
                { text: '📋 Copy cURL', action: function() { 
                    copyTextToClipboard(generateCurl(request));
                    showStatus('cURL copied!');
                }},
                { text: '🔗 Copy URL', action: function() { 
                    copyTextToClipboard(request.url);
                    showStatus('URL copied!');
                }},
                { text: '📄 Copy All', action: function() { 
                    copyTextToClipboard(formatFullRequest(request));
                    showStatus('All data copied!');
                }}
            ];

            buttons.forEach(function(btn) {
                const button = document.createElement('button');
                button.textContent = btn.text;
                Object.assign(button.style, {
                    padding: '8px 16px',
                    backgroundColor: '#0078d7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    fontWeight: 'bold',
                    flex: '1',
                    minWidth: '120px'
                });
                button.onmouseover = function() { button.style.backgroundColor = '#005a9e'; };
                button.onmouseout = function() { button.style.backgroundColor = '#0078d7'; };
                button.onclick = btn.action;
                buttonContainer.appendChild(button);
            });

            detailsContainer.appendChild(buttonContainer);

            if (sectionSettings.requestInfo) {
                const infoContent = 'Method: ' + request.method + '\n' +
                    'URL: ' + request.url + '\n' +
                    'Status: ' + request.status + ' ' + (request.statusText || '') + '\n' +
                    'Time: ' + request.timestamp + '\n' +
                    'Type: ' + request.type.toUpperCase();
                detailsContainer.appendChild(createSectionCard('REQUEST INFO', infoContent, '#0078d7'));
            }

            if (sectionSettings.requestHeaders && Object.keys(request.headers).length > 0) {
                const headersContent = JSON.stringify(request.headers, null, 2);
                detailsContainer.appendChild(createSectionCard('REQUEST HEADERS', headersContent, '#107c10'));
            }

            if (sectionSettings.requestBody && request.body) {
                detailsContainer.appendChild(createSectionCard('REQUEST BODY', request.body, '#8764b8'));
            }

            if (sectionSettings.responseHeaders && Object.keys(request.responseHeaders).length > 0) {
                const respHeadersContent = JSON.stringify(request.responseHeaders, null, 2);
                detailsContainer.appendChild(createSectionCard('RESPONSE HEADERS', respHeadersContent, '#ff8c00'));
            }

            if (sectionSettings.responseBody && request.response) {
                detailsContainer.appendChild(createSectionCard('RESPONSE BODY', request.response, '#d13438'));
            }

            if (detailsContainer.children.length === 1) {
                detailsContainer.innerHTML += '<div style="padding: 20px; text-align: center; color: #999;">No sections to display (check options above)</div>';
            }
        }

        function showStatus(message) {
            statusMsg.textContent = '✅ ' + message;
            statusMsg.style.color = '#2b7a0b';
            setTimeout(function() {
                statusMsg.textContent = '';
            }, 2000);
        }

        function formatRequest(request) {
            return request.method + ' ' + request.url + '\n\nHeaders:\n' + JSON.stringify(request.headers, null, 2) + '\n\nBody:\n' + (request.body || 'No body');
        }

        function formatFullRequest(request) {
            return '=== REQUEST ===\n' + formatRequest(request) + '\n\n=== RESPONSE ===\nStatus: ' + request.status + ' ' + (request.statusText || '') + '\n\nHeaders:\n' + JSON.stringify(request.responseHeaders, null, 2) + '\n\nBody:\n' + (request.response || 'No response');
        }

        function getMethodColor(method) {
            const colors = {
                'GET': '#107c10',
                'POST': '#0078d7',
                'PUT': '#ff8c00',
                'DELETE': '#d13438',
                'PATCH': '#8764b8',
                'HEAD': '#5c2d91',
                'OPTIONS': '#008272'
            };
            return colors[method] || '#666';
        }

        function getStatusColor(status) {
            if (!status || status === 'Pending') return '#999';
            if (status === 'Failed') return '#d13438';
            if (status >= 200 && status < 300) return '#107c10';
            if (status >= 300 && status < 400) return '#ff8c00';
            return '#d13438';
        }

        function truncateUrl(url, maxLength) {
            return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
        }

        refreshButton.onclick = function() {
            renderRequests();
            showStatus('Refreshed - ' + capturedRequests.length + ' requests');
        };

        clearButton.onclick = function() {
            capturedRequests.length = 0;
            selectedRequestId = null;
            renderRequests();
            showStatus('All requests cleared');
        };

        autoRefreshCheckbox.onchange = function() {
            if (this.checked) {
                autoRefreshInterval = setInterval(function() {
                    renderRequests();
                }, filterSettings.autoRefreshInterval);
            } else {
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
            }
        };

        if (autoRefreshCheckbox.checked) {
            autoRefreshInterval = setInterval(function() {
                renderRequests();
            }, filterSettings.autoRefreshInterval);
        }

        let isMinimized = false;
        minimizeButton.onclick = function() {
            if (isMinimized) {
                content.style.display = 'flex';
                container.style.height = 'auto';
                container.style.minHeight = '400px';
                container.style.resize = 'both';
                minimizeButton.textContent = '−';
                minimizeButton.title = 'Minimize';
                isMinimized = false;
            } else {
                content.style.display = 'none';
                container.style.height = 'auto';
                container.style.minHeight = '0';
                container.style.resize = 'horizontal';
                minimizeButton.textContent = '□';
                minimizeButton.title = 'Maximize';
                isMinimized = true;
            }
        };

        content.appendChild(searchLabel);
        content.appendChild(searchContainer);
        content.appendChild(controlLabel);
        content.appendChild(controlBar);
        content.appendChild(optionsContainer);
        content.appendChild(listLabel);
        content.appendChild(listContainer);
        content.appendChild(detailsLabel);
        content.appendChild(detailsContainer);
        content.appendChild(statusMsg);

        container.appendChild(header);
        container.appendChild(content);

        document.body.appendChild(container);
        
        makeDraggable(container, header);
        
        renderRequests();
    }

    window.viewNetworkRequests = showRequestViewer;
    window.toggleNetworkMonitor = showRequestViewer;
    
    console.log('%c✅ XHR/Fetch Monitor Loaded!', 'color: #0078d7; font-size: 14px; font-weight: bold;');
    console.log('Call viewNetworkRequests() or toggleNetworkMonitor() to show/hide');
    
    showRequestViewer();
})();
