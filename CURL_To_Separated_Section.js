(function() {
    'use strict';
    
    /**
     * cURL Parser - Auto-parse on paste
     */
    
    function parseCurl(curlCommand) {
        if (!curlCommand || typeof curlCommand !== 'string') {
            return { error: 'Invalid cURL command' };
        }

        const result = {
            method: 'GET',
            url: '',
            baseUrl: '',
            headers: {},
            body: null,
            bodyParsed: null,
            queryParams: {},
            cookies: null,
            auth: null,
            authorization: null,
            compressed: false,
            insecure: false,
            followRedirects: false,
            rawCommand: curlCommand.trim()
        };

        try {
            // Clean up the command - handle line continuations properly
            let cleanCmd = curlCommand
                .replace(/\\\r?\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Extract HTTP method
            const methodMatch = cleanCmd.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
            if (methodMatch) {
                result.method = methodMatch[1].toUpperCase();
            }

            // Extract URL - non-greedy matching
            const urlPatterns = [
                /curl\s+'([^']+)'/,      // curl 'url'
                /curl\s+"([^"]+)"/,      // curl "url"
                /curl\s+([^\s'"-]+)/     // curl url
            ];
            
            for (let pattern of urlPatterns) {
                const urlMatch = cleanCmd.match(pattern);
                if (urlMatch) {
                    result.url = urlMatch[1];
                    break;
                }
            }

            // Parse URL components
            if (result.url) {
                const urlParts = result.url.split('?');
                result.baseUrl = urlParts[0];
                
                if (urlParts[1]) {
                    const params = new URLSearchParams(urlParts[1]);
                    params.forEach((value, key) => {
                        result.queryParams[key] = value;
                    });
                }
            }

            // Extract headers - use non-greedy matching
            const headerPattern = /-H\s+['"]([^'"]+?)['"]/g;
            let headerMatch;
            while ((headerMatch = headerPattern.exec(cleanCmd)) !== null) {
                const headerStr = headerMatch[1];
                const colonIndex = headerStr.indexOf(':');
                if (colonIndex > -1) {
                    const key = headerStr.substring(0, colonIndex).trim();
                    const value = headerStr.substring(colonIndex + 1).trim();
                    result.headers[key] = value;
                    
                    // Extract Authorization separately
                    if (key.toLowerCase() === 'authorization') {
                        result.authorization = value;
                    }
                }
            }

            // Extract body data - use non-greedy and avoid duplicates
            // Only match the FIRST occurrence of -d/--data
            const dataPatterns = [
                /-d\s+'([^']+?)'/,           // -d 'data'
                /-d\s+"([^"]+?)"/,           // -d "data"
                /--data\s+'([^']+?)'/,       // --data 'data'
                /--data\s+"([^"]+?)"/,       // --data "data"
                /--data-raw\s+'([^']+?)'/,   // --data-raw 'data'
                /--data-raw\s+"([^"]+?)"/,   // --data-raw "data"
                /--data-binary\s+'([^']+?)'/, // --data-binary 'data'
                /--data-binary\s+"([^"]+?)"/, // --data-binary "data"
                /-d\s+([^\s'"-][^\s]*)/,     // -d data (no quotes)
                /--data\s+([^\s'"-][^\s]*)/  // --data data (no quotes)
            ];
            
            // Try each pattern and stop at first match
            for (let pattern of dataPatterns) {
                const match = cleanCmd.match(pattern);
                if (match) {
                    result.body = match[1];
                    break; // Stop after first match to avoid duplicates
                }
            }
            
            // Parse body if found
            if (result.body) {
                // Try to parse as JSON
                try {
                    result.bodyParsed = JSON.parse(result.body);
                } catch (e) {
                    // Try URL-encoded
                    if (result.body.includes('=')) {
                        result.bodyParsed = {};
                        result.body.split('&').forEach(pair => {
                            const [key, value] = pair.split('=');
                            if (key) {
                                try {
                                    result.bodyParsed[decodeURIComponent(key)] = decodeURIComponent(value || '');
                                } catch (e) {
                                    result.bodyParsed[key] = value || '';
                                }
                            }
                        });
                    }
                }
            }

            // Extract cookies
            const cookiePatterns = [
                /--cookie\s+'([^']+?)'/,
                /--cookie\s+"([^"]+?)"/,
                /-b\s+'([^']+?)'/,
                /-b\s+"([^"]+?)"/
            ];
            
            for (let pattern of cookiePatterns) {
                const match = cleanCmd.match(pattern);
                if (match) {
                    result.cookies = match[1];
                    break;
                }
            }

            // Extract authentication (--user or -u)
            const authPatterns = [
                /--user\s+'([^']+?)'/,
                /--user\s+"([^"]+?)"/,
                /-u\s+'([^']+?)'/,
                /-u\s+"([^"]+?)"/,
                /--user\s+([^\s'"-]+)/,
                /-u\s+([^\s'"-]+)/
            ];
            
            for (let pattern of authPatterns) {
                const match = cleanCmd.match(pattern);
                if (match) {
                    result.auth = match[1];
                    break;
                }
            }

            // Extract flags
            result.compressed = /--compressed/.test(cleanCmd);
            result.insecure = /(?:--insecure|-k)(?:\s|$)/.test(cleanCmd);
            result.followRedirects = /(?:--location|-L)(?:\s|$)/.test(cleanCmd);

        } catch (error) {
            result.parseError = error.message;
        }

        return result;
    }

    function createSectionCard(title, content, color = '#0078d7') {
        const card = document.createElement('div');
        Object.assign(card.style, {
            marginBottom: '15px',
            border: '2px solid ' + color,
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#fff'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '10px 15px',
            backgroundColor: color,
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });
        header.textContent = title;

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy';
        Object.assign(copyBtn.style, {
            padding: '4px 10px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer'
        });
        copyBtn.onmouseover = function() { copyBtn.style.backgroundColor = 'rgba(255,255,255,0.3)'; };
        copyBtn.onmouseout = function() { copyBtn.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
        copyBtn.onclick = function() {
            copyToClipboard(content);
            copyBtn.textContent = '✓ Copied!';
            setTimeout(function() { copyBtn.textContent = '📋 Copy'; }, 2000);
        };
        header.appendChild(copyBtn);

        const contentDiv = document.createElement('pre');
        Object.assign(contentDiv.style, {
            padding: '15px',
            margin: '0',
            backgroundColor: '#f9f9f9',
            fontSize: '12px',
            fontFamily: 'Consolas, Monaco, monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            maxHeight: '200px',
            overflow: 'auto',
            color: '#333'
        });
        contentDiv.textContent = content;

        card.appendChild(header);
        card.appendChild(contentDiv);
        return card;
    }

    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function showCurlParser() {
        const existing = document.getElementById('curl-parser-container');
        if (existing) {
            if (existing.style.display === 'none') {
                existing.style.display = 'flex';
            } else {
                existing.style.display = 'none';
            }
            return;
        }

        const container = document.createElement('div');
        container.id = 'curl-parser-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '10001',
            backgroundColor: '#fff',
            padding: '0',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: '14px',
            color: '#333',
            width: '800px',
            minWidth: '400px',
            maxWidth: '95vw',
            minHeight: '300px',
            maxHeight: '95vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            resize: 'both'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '15px 20px',
            backgroundColor: '#107c10',
            color: '#fff',
            borderRadius: '12px 12px 0 0',
            fontWeight: 'bold',
            fontSize: '16px',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'move',
            flexShrink: '0'
        });

        const title = document.createElement('span');
        title.textContent = '🔧 cURL Parser';
        header.appendChild(title);

        const headerButtons = document.createElement('div');
        Object.assign(headerButtons.style, {
            display: 'flex',
            gap: '10px',
            alignItems: 'center'
        });

        const minimizeBtn = document.createElement('button');
        minimizeBtn.textContent = '−';
        minimizeBtn.title = 'Minimize';
        Object.assign(minimizeBtn.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 8px',
            lineHeight: '1',
            fontWeight: 'bold'
        });
        minimizeBtn.onmouseover = function() { minimizeBtn.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
        minimizeBtn.onmouseout = function() { minimizeBtn.style.backgroundColor = 'transparent'; };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.title = 'Hide';
        Object.assign(closeBtn.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '28px',
            cursor: 'pointer',
            padding: '0 8px',
            lineHeight: '1'
        });
        closeBtn.onmouseover = function() { closeBtn.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
        closeBtn.onmouseout = function() { closeBtn.style.backgroundColor = 'transparent'; };
        closeBtn.onclick = function() { 
            container.style.display = 'none';
        };

        headerButtons.appendChild(minimizeBtn);
        headerButtons.appendChild(closeBtn);
        header.appendChild(headerButtons);

        const contentWrapper = document.createElement('div');
        contentWrapper.id = 'curl-parser-content-wrapper';
        Object.assign(contentWrapper.style, {
            flex: '1',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            padding: '20px',
            overflow: 'auto',
            flex: '1'
        });

        const inputLabel = document.createElement('div');
        inputLabel.innerHTML = '📥 <strong>Paste cURL Command:</strong> <span style="color: #999; font-size: 12px; font-weight: normal;">(auto-parses on paste)</span>';
        Object.assign(inputLabel.style, {
            marginBottom: '10px',
            fontSize: '14px',
            color: '#333'
        });

        const textarea = document.createElement('textarea');
        Object.assign(textarea.style, {
            width: '100%',
            height: '120px',
            padding: '12px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'Consolas, Monaco, monospace',
            resize: 'vertical',
            boxSizing: 'border-box',
            color: '#333',
            backgroundColor: '#fff'
        });
        textarea.placeholder = "curl 'https://api.example.com/users?page=1' -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer token123' -d '{\"name\":\"John\"}'";

        const style = document.createElement('style');
        style.textContent = `
            #curl-parser-container textarea::placeholder {
                color: #999 !important;
                opacity: 1 !important;
            }
            #curl-parser-container textarea::-webkit-input-placeholder {
                color: #999 !important;
            }
            #curl-parser-container textarea::-moz-placeholder {
                color: #999 !important;
                opacity: 1 !important;
            }
            #curl-parser-container textarea:-ms-input-placeholder {
                color: #999 !important;
            }
            
            @media (max-width: 768px) {
                #curl-parser-container {
                    width: 95vw !important;
                    height: 90vh !important;
                    top: 5px !important;
                    left: 50% !important;
                }
            }
            
            #curl-parser-container::-webkit-resizer {
                background: #107c10;
                border-radius: 0 0 12px 0;
            }
            
            @keyframes flash-border {
                0%, 100% { border-color: #ddd; }
                50% { border-color: #107c10; }
            }
            
            .parsing-flash {
                animation: flash-border 0.5s ease;
            }
        `;
        document.head.appendChild(style);

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            margin: '15px 0',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
        });

        const parseBtn = document.createElement('button');
        parseBtn.textContent = '⚡ Parse cURL';
        Object.assign(parseBtn.style, {
            flex: '1',
            minWidth: '120px',
            padding: '10px',
            backgroundColor: '#0078d7',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
        });
        parseBtn.onmouseover = function() { parseBtn.style.backgroundColor = '#005a9e'; };
        parseBtn.onmouseout = function() { parseBtn.style.backgroundColor = '#0078d7'; };

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️ Clear';
        Object.assign(clearBtn.style, {
            padding: '10px 20px',
            backgroundColor: '#d13438',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
        });
        clearBtn.onmouseover = function() { clearBtn.style.backgroundColor = '#a02c2f'; };
        clearBtn.onmouseout = function() { clearBtn.style.backgroundColor = '#d13438'; };
        clearBtn.onclick = function() {
            textarea.value = '';
            sectionsContainer.innerHTML = '';
            sectionsLabel.style.display = 'none';
        };

        buttonContainer.appendChild(parseBtn);
        buttonContainer.appendChild(clearBtn);

        const sectionsLabel = document.createElement('div');
        sectionsLabel.innerHTML = '📊 <strong>Extracted Sections:</strong>';
        Object.assign(sectionsLabel.style, {
            marginTop: '20px',
            marginBottom: '10px',
            fontSize: '14px',
            color: '#107c10',
            display: 'none'
        });

        const sectionsContainer = document.createElement('div');
        sectionsContainer.id = 'sections-output';

        function performParse() {
            const curlCommand = textarea.value.trim();
            if (!curlCommand) {
                sectionsContainer.innerHTML = '';
                sectionsLabel.style.display = 'none';
                return;
            }

            // Check if it looks like a curl command
            if (!curlCommand.toLowerCase().includes('curl')) {
                sectionsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff8c00; background: #fff; border: 2px solid #ff8c00; border-radius: 8px;">⚠️ This doesn\'t look like a cURL command</div>';
                sectionsLabel.style.display = 'none';
                return;
            }

            const parsed = parseCurl(curlCommand);
            
            if (parsed.error || parsed.parseError) {
                sectionsContainer.innerHTML = '<div style="padding: 20px; color: #d13438; background: #fff; border: 2px solid #d13438; border-radius: 8px;"><strong>Error:</strong> ' + (parsed.error || parsed.parseError) + '</div>';
                sectionsLabel.style.display = 'none';
                return;
            }

            sectionsContainer.innerHTML = '';
            sectionsLabel.style.display = 'block';

            // Section 1: Request Line
            const requestLine = `${parsed.method} ${parsed.url}`;
            sectionsContainer.appendChild(createSectionCard('REQUEST LINE', requestLine, '#0078d7'));

            // Section 2: Base URL
            if (parsed.baseUrl) {
                sectionsContainer.appendChild(createSectionCard('BASE URL', parsed.baseUrl, '#8764b8'));
            }

            // Section 3: Query Parameters
            if (Object.keys(parsed.queryParams).length > 0) {
                let queryStr = '';
                for (let [key, value] of Object.entries(parsed.queryParams)) {
                    queryStr += `${key} = ${value}\n`;
                }
                sectionsContainer.appendChild(createSectionCard('QUERY PARAMETERS', queryStr.trim(), '#ff8c00'));
            }

            // Section 4: Authorization (extracted separately)
            if (parsed.authorization) {
                sectionsContainer.appendChild(createSectionCard('AUTHORIZATION', parsed.authorization, '#b4009e'));
            }

            // Section 5: Headers (without Authorization)
            const headersWithoutAuth = {};
            for (let [key, value] of Object.entries(parsed.headers)) {
                if (key.toLowerCase() !== 'authorization') {
                    headersWithoutAuth[key] = value;
                }
            }
            
            if (Object.keys(headersWithoutAuth).length > 0) {
                let headersStr = '';
                for (let [key, value] of Object.entries(headersWithoutAuth)) {
                    headersStr += `${key}: ${value}\n`;
                }
                sectionsContainer.appendChild(createSectionCard('HEADERS', headersStr.trim(), '#107c10'));
            }

            // Section 6: Request Body (Raw) - NO DUPLICATION
            if (parsed.body) {
                sectionsContainer.appendChild(createSectionCard('REQUEST BODY (RAW)', parsed.body, '#d13438'));
            }

            // Section 7: Request Body (Parsed)
            if (parsed.bodyParsed) {
                const bodyParsedStr = JSON.stringify(parsed.bodyParsed, null, 2);
                sectionsContainer.appendChild(createSectionCard('REQUEST BODY (PARSED)', bodyParsedStr, '#005a9e'));
            }

            // Section 8: Cookies
            if (parsed.cookies) {
                sectionsContainer.appendChild(createSectionCard('COOKIES', parsed.cookies, '#744da9'));
            }

            // Section 9: Basic Auth (--user)
            if (parsed.auth) {
                sectionsContainer.appendChild(createSectionCard('BASIC AUTHENTICATION', parsed.auth, '#ff6b6b'));
            }

            // Section 10: Options/Flags
            const options = [];
            if (parsed.compressed) options.push('✓ Compression enabled');
            if (parsed.insecure) options.push('✓ SSL verification disabled');
            if (parsed.followRedirects) options.push('✓ Follow redirects');
            
            if (options.length > 0) {
                sectionsContainer.appendChild(createSectionCard('OPTIONS & FLAGS', options.join('\n'), '#666'));
            }

            if (sectionsContainer.children.length === 0) {
                sectionsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; background: #fff; border: 2px solid #ddd; border-radius: 8px;">No sections extracted. Check your cURL syntax.</div>';
                sectionsLabel.style.display = 'none';
            }
        }

        // Manual parse button
        parseBtn.onclick = performParse;

        // AUTO-PARSE ON PASTE [web:1]
        textarea.addEventListener('paste', function(e) {
            // Add visual feedback
            textarea.classList.add('parsing-flash');
            
            // Wait for paste to complete, then parse
            setTimeout(function() {
                performParse();
                textarea.classList.remove('parsing-flash');
            }, 100);
        });

        let isMinimized = false;
        minimizeBtn.onclick = function() {
            if (isMinimized) {
                contentWrapper.style.display = 'flex';
                container.style.height = 'auto';
                container.style.minHeight = '300px';
                container.style.resize = 'both';
                minimizeBtn.textContent = '−';
                minimizeBtn.title = 'Minimize';
                title.textContent = '🔧 cURL Parser';
                isMinimized = false;
            } else {
                contentWrapper.style.display = 'none';
                container.style.height = 'auto';
                container.style.minHeight = '0';
                container.style.resize = 'horizontal';
                minimizeBtn.textContent = '□';
                minimizeBtn.title = 'Maximize';
                title.textContent = '🔧 cURL Parser (Minimized)';
                isMinimized = true;
            }
        };

        content.appendChild(inputLabel);
        content.appendChild(textarea);
        content.appendChild(buttonContainer);
        content.appendChild(sectionsLabel);
        content.appendChild(sectionsContainer);

        contentWrapper.appendChild(content);
        container.appendChild(header);
        container.appendChild(contentWrapper);
        document.body.appendChild(container);

        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let isDragging = false;
        
        header.onmousedown = function(e) {
            if (e.target === minimizeBtn || e.target === closeBtn) return;
            e.preventDefault();
            isDragging = true;
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDrag;
            document.onmousemove = dragElement;
        };

        function dragElement(e) {
            if (!isDragging) return;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            container.style.top = (container.offsetTop - pos2) + 'px';
            container.style.left = (container.offsetLeft - pos1) + 'px';
            container.style.transform = 'none';
        }

        function closeDrag() {
            isDragging = false;
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    window.parseCurlCommand = parseCurl;
    window.showCurlParser = showCurlParser;
    window.toggleCurlParser = showCurlParser;
    
    console.log('%c✅ cURL Parser Loaded!', 'color: #107c10; font-size: 14px; font-weight: bold;');
    console.log('Commands: showCurlParser() | parseCurlCommand(curlString)');
    console.log('💡 Tip: Just paste a cURL command - it auto-parses!');
    
    showCurlParser();
})();
