(function() {
    'use strict';
    
    const capturedRequests = [];
    let requestIdCounter = 0;
    let autoRefreshInterval = null;

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

    function showRequestViewer() {
        const existing = document.getElementById('request-viewer');
        if (existing) {
            document.body.removeChild(existing);
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
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
            width: '700px',
            minWidth: '400px',
            minHeight: '300px',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxSizing: 'border-box',
            resize: 'both',
            display: 'flex',
            flexDirection: 'column'
        });

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
            alignItems: 'center'
        });

        const titleText = document.createElement('span');
        titleText.id = 'request-viewer-title';
        titleText.textContent = 'XHR/Fetch Monitor (' + capturedRequests.length + ' requests)';

        const minimizeButton = document.createElement('button');
        minimizeButton.textContent = '_';
        Object.assign(minimizeButton.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 8px',
            marginLeft: '10px'
        });
        minimizeButton.onclick = function() {
            const content = document.getElementById('request-viewer-content');
            if (content.style.display === 'none') {
                content.style.display = 'flex';
                container.style.height = 'auto';
                minimizeButton.textContent = '_';
            } else {
                content.style.display = 'none';
                container.style.height = 'auto';
                container.style.resize = 'none';
                minimizeButton.textContent = '□';
            }
        };

        header.appendChild(titleText);
        header.appendChild(minimizeButton);

        const content = document.createElement('div');
        content.id = 'request-viewer-content';
        Object.assign(content.style, {
            padding: '20px',
            overflow: 'auto',
            flex: '1',
            display: 'flex',
            flexDirection: 'column'
        });

        const controlBar = document.createElement('div');
        Object.assign(controlBar.style, {
            marginBottom: '15px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap'
        });

        const autoRefreshCheckbox = document.createElement('input');
        autoRefreshCheckbox.type = 'checkbox';
        autoRefreshCheckbox.id = 'auto-refresh-checkbox';
        autoRefreshCheckbox.checked = true;
        autoRefreshCheckbox.style.cursor = 'pointer';

        const autoRefreshLabel = document.createElement('label');
        autoRefreshLabel.setAttribute('for', 'auto-refresh-checkbox');
        autoRefreshLabel.textContent = 'Auto-refresh (2s)';
        autoRefreshLabel.style.cursor = 'pointer';
        autoRefreshLabel.style.fontSize = '13px';

        const listContainer = document.createElement('div');
        Object.assign(listContainer.style, {
            maxHeight: '250px',
            overflowY: 'auto',
            marginBottom: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '10px',
            backgroundColor: '#f9f9f9',
            flex: '0 0 auto'
        });

        const detailsContainer = document.createElement('div');
        Object.assign(detailsContainer.style, {
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '15px',
            backgroundColor: '#fafafa',
            minHeight: '200px',
            overflow: 'auto',
            flex: '1'
        });

        const statusMsg = document.createElement('div');
        statusMsg.style.fontSize = '12px';
        statusMsg.style.marginTop = '10px';
        statusMsg.style.minHeight = '18px';

        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh';
        Object.assign(refreshButton.style, {
            padding: '6px 12px',
            backgroundColor: '#107c10',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
        });
        refreshButton.onmouseover = function() { refreshButton.style.backgroundColor = '#0b5300'; };
        refreshButton.onmouseout = function() { refreshButton.style.backgroundColor = '#107c10'; };
        refreshButton.onclick = function() {
            renderRequests();
            statusMsg.textContent = '✅ Refreshed - ' + capturedRequests.length + ' requests';
            statusMsg.style.color = '#2b7a0b';
        };

        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear All';
        Object.assign(clearButton.style, {
            padding: '6px 12px',
            backgroundColor: '#d13438',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
        });
        clearButton.onmouseover = function() { clearButton.style.backgroundColor = '#a02c2f'; };
        clearButton.onmouseout = function() { clearButton.style.backgroundColor = '#d13438'; };
        clearButton.onclick = function() {
            capturedRequests.length = 0;
            renderRequests();
            titleText.textContent = 'XHR/Fetch Monitor (0 requests)';
            statusMsg.textContent = '✅ All requests cleared';
            statusMsg.style.color = '#2b7a0b';
        };

        controlBar.appendChild(autoRefreshCheckbox);
        controlBar.appendChild(autoRefreshLabel);
        controlBar.appendChild(refreshButton);
        controlBar.appendChild(clearButton);

        autoRefreshCheckbox.onchange = function() {
            if (this.checked) {
                autoRefreshInterval = setInterval(function() {
                    renderRequests();
                    titleText.textContent = 'XHR/Fetch Monitor (' + capturedRequests.length + ' requests)';
                }, 2000);
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
                titleText.textContent = 'XHR/Fetch Monitor (' + capturedRequests.length + ' requests)';
            }, 2000);
        }

        function renderRequests() {
            listContainer.innerHTML = '';
            detailsContainer.innerHTML = '<div style="color: #999;">Select a request to view details</div>';
            titleText.textContent = 'XHR/Fetch Monitor (' + capturedRequests.length + ' requests)';

            if (capturedRequests.length === 0) {
                listContainer.innerHTML = '<div style="color: #999;">No XHR/Fetch requests captured yet.<br><br>Make sure this script runs BEFORE the page makes requests.<br>Try reloading the page with the script active.</div>';
                return;
            }

            const reversedRequests = capturedRequests.slice().reverse();
            
            reversedRequests.forEach(function(req, index) {
                const requestItem = document.createElement('div');
                Object.assign(requestItem.style, {
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: '#fff',
                    border: '1.5px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                });

                requestItem.onmouseover = function() {
                    requestItem.style.backgroundColor = '#e6f0fa';
                    requestItem.style.borderColor = '#0078d7';
                };
                requestItem.onmouseout = function() {
                    requestItem.style.backgroundColor = '#fff';
                    requestItem.style.borderColor = '#ddd';
                };

                const methodBadge = document.createElement('span');
                methodBadge.textContent = req.method;
                Object.assign(methodBadge.style, {
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: getMethodColor(req.method),
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    marginRight: '8px'
                });

                const typeBadge = document.createElement('span');
                typeBadge.textContent = req.type.toUpperCase();
                Object.assign(typeBadge.style, {
                    display: 'inline-block',
                    padding: '2px 6px',
                    backgroundColor: req.type === 'fetch' ? '#8764b8' : '#ff8c00',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    marginRight: '8px'
                });

                const urlText = document.createElement('span');
                urlText.textContent = truncateUrl(req.url, 45);
                urlText.style.fontSize = '13px';

                const statusBadge = document.createElement('span');
                statusBadge.textContent = req.status || 'Pending';
                Object.assign(statusBadge.style, {
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: getStatusColor(req.status),
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    marginLeft: '8px'
                });

                const timeText = document.createElement('span');
                timeText.textContent = formatTime(req.timestamp);
                Object.assign(timeText.style, {
                    fontSize: '11px',
                    color: '#666',
                    marginLeft: '8px',
                    fontFamily: 'monospace'
                });

                requestItem.appendChild(methodBadge);
                requestItem.appendChild(typeBadge);
                requestItem.appendChild(urlText);
                requestItem.appendChild(statusBadge);
                requestItem.appendChild(timeText);

                requestItem.onclick = function() { showRequestDetails(req); };
                
                listContainer.appendChild(requestItem);

                if (index === 0) {
                    setTimeout(function() { showRequestDetails(req); }, 100);
                }
            });
        }

        function showRequestDetails(request) {
            detailsContainer.innerHTML = '';

            const infoSection = createSection('Request Information');
            infoSection.innerHTML += '<div style="margin: 8px 0;"><strong>Method:</strong> ' + request.method + '</div>' +
                '<div style="margin: 8px 0;"><strong>URL:</strong> ' + request.url + '</div>' +
                '<div style="margin: 8px 0;"><strong>Status:</strong> ' + request.status + ' ' + (request.statusText || '') + '</div>' +
                '<div style="margin: 8px 0;"><strong>Time:</strong> ' + request.timestamp + '</div>' +
                '<div style="margin: 8px 0;"><strong>Type:</strong> ' + request.type.toUpperCase() + '</div>';

            const buttonContainer = document.createElement('div');
            buttonContainer.style.margin = '15px 0';

            const buttons = [
                { text: 'Copy URL', action: function() { copyData(request.url, 'URL'); } },
                { text: 'Copy Request', action: function() { copyData(formatRequest(request), 'Request'); } },
                { text: 'Copy Response', action: function() { copyData(request.response || 'No response', 'Response'); } },
                { text: 'Copy cURL', action: function() { copyData(generateCurl(request), 'cURL'); } },
                { text: 'Copy Headers', action: function() { copyData(JSON.stringify(request.headers, null, 2), 'Headers'); } },
                { text: 'Copy All', action: function() { copyData(formatFullRequest(request), 'Complete request data'); } }
            ];

            buttons.forEach(function(btn) {
                const button = document.createElement('button');
                button.textContent = btn.text;
                Object.assign(button.style, {
                    padding: '6px 12px',
                    backgroundColor: '#0078d7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginRight: '8px',
                    marginBottom: '8px',
                    transition: 'background-color 0.3s ease'
                });
                button.onmouseover = function() { button.style.backgroundColor = '#005a9e'; };
                button.onmouseout = function() { button.style.backgroundColor = '#0078d7'; };
                button.onclick = btn.action;
                buttonContainer.appendChild(button);
            });

            if (Object.keys(request.headers).length > 0) {
                const headersSection = createSection('Request Headers');
                headersSection.innerHTML += '<pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">' + JSON.stringify(request.headers, null, 2) + '</pre>';
                detailsContainer.appendChild(headersSection);
            }

            if (request.body) {
                const bodySection = createSection('Request Body');
                bodySection.innerHTML += '<pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; max-height: 150px;">' + escapeHtml(request.body) + '</pre>';
                detailsContainer.appendChild(bodySection);
            }

            if (Object.keys(request.responseHeaders).length > 0) {
                const respHeadersSection = createSection('Response Headers');
                respHeadersSection.innerHTML += '<pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">' + JSON.stringify(request.responseHeaders, null, 2) + '</pre>';
                detailsContainer.appendChild(respHeadersSection);
            }

            if (request.response) {
                const responseSection = createSection('Response Body');
                responseSection.innerHTML += '<pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; max-height: 200px;">' + escapeHtml(request.response) + '</pre>';
                detailsContainer.appendChild(responseSection);
            }

            detailsContainer.insertBefore(buttonContainer, detailsContainer.firstChild);
            detailsContainer.insertBefore(infoSection, detailsContainer.firstChild);
        }

        function createSection(title) {
            const section = document.createElement('div');
            section.style.marginBottom = '15px';
            const titleEl = document.createElement('div');
            titleEl.textContent = title;
            Object.assign(titleEl.style, {
                fontWeight: 'bold',
                marginBottom: '8px',
                color: '#555',
                fontSize: '13px'
            });
            section.appendChild(titleEl);
            return section;
        }

        function copyData(data, label) {
            copyTextToClipboard(data).then(function(success) {
                statusMsg.textContent = success ? '✅ ' + label + ' copied to clipboard!' : '⚠️ Failed to copy ' + label;
                statusMsg.style.color = success ? '#2b7a0b' : '#cc6c00';
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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
                'PATCH': '#8764b8'
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

        content.appendChild(controlBar);
        content.appendChild(listContainer);
        content.appendChild(detailsContainer);
        content.appendChild(statusMsg);

        container.appendChild(header);
        container.appendChild(content);

        document.body.appendChild(container);
        
        makeDraggable(container, header);
        
        renderRequests();
    }

    window.viewNetworkRequests = showRequestViewer;
    
    console.log('XHR/Fetch monitor initialized! Captured: ' + capturedRequests.length + ' requests. Call viewNetworkRequests() to view.');
    
    showRequestViewer();
})();
