// Advanced DOM Element Inspector - Fixed Freeze Bug
(function() {
    'use strict';
    
    let inspectorEnabled = false;
    let currentHighlight = null;
    let tooltip = null;
    let isHoveringTooltip = false;
    let lastInspectedElement = null;
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let isMinimized = false;
    let updatePending = false;
    let isFrozen = false;
    let frozenElement = null;
    
    // Notification system
    function showNotification(message, type = 'info') {
        const existingNotif = document.querySelector('.inspector-notification');
        if (existingNotif) existingNotif.remove();
        
        const colors = {
            'success': { bg: '#10b981', icon: '✓' },
            'info': { bg: '#3b82f6', icon: 'ℹ' },
            'warning': { bg: '#f59e0b', icon: '⚠' },
            'error': { bg: '#ef4444', icon: '✕' }
        };
        
        const config = colors[type] || colors['info'];
        
        const notif = document.createElement('div');
        notif.className = 'inspector-notification';
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${config.bg};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            font-weight: 500;
            z-index: 1000001;
            animation: slideIn 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 8px;
            direction: ltr;
        `;
        
        notif.innerHTML = `<span style="font-size: 18px;">${config.icon}</span><span>${message}</span>`;
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
    
    // Add animations
    if (!document.querySelector('style[data-inspector-styles]')) {
        const style = document.createElement('style');
        style.setAttribute('data-inspector-styles', 'true');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            .inspector-highlight-overlay {
                position: absolute;
                pointer-events: none;
                border: 2px solid #667eea;
                background: rgba(102, 126, 234, 0.1);
                z-index: 999999;
                box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
            }
            .inspector-highlight-overlay.frozen {
                border: 3px solid #10b981;
                background: rgba(16, 185, 129, 0.15);
                box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
            }
            .inspector-tooltip::-webkit-scrollbar {
                width: 10px;
            }
            .inspector-tooltip::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            .inspector-tooltip::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Copy to clipboard
    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = button.innerHTML;
            const originalBg = button.style.background;
            button.innerHTML = '✓';
            button.style.background = '#10b981';
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.background = originalBg;
            }, 1500);
        }).catch(err => {
            console.error('Copy failed:', err);
            showNotification('Failed to copy', 'error');
        });
    }
    
    // Generate Absolute XPath (with safety limit)
    function getAbsoluteXPath(element) {
        try {
            if (!element || element.nodeType !== 1) return 'N/A';
            if (element.id) return `//*[@id="${element.id}"]`;
            if (element === document.body) return '/html/body';
            
            let path = '';
            let current = element;
            let depth = 0;
            const maxDepth = 50;
            
            while (current && current.nodeType === Node.ELEMENT_NODE && depth < maxDepth) {
                let index = 1;
                let sibling = current.previousSibling;
                
                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
                        index++;
                    }
                    sibling = sibling.previousSibling;
                }
                
                const tagName = current.tagName.toLowerCase();
                path = `/${tagName}[${index}]${path}`;
                current = current.parentNode;
                depth++;
            }
            
            return path || 'N/A';
        } catch(e) {
            console.error('XPath error:', e);
            return 'Error generating XPath';
        }
    }
    
    // Generate Relative XPath (simplified and safe)
    function getRelativeXPath(element) {
        try {
            if (!element || element.nodeType !== 1) return 'N/A';
            if (element.id) return `//*[@id="${element.id}"]`;
            
            let parts = [];
            let current = element;
            let depth = 0;
            const maxDepth = 10;
            
            while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && depth < maxDepth) {
                let part = current.tagName.toLowerCase();
                
                if (current.id) {
                    return `//*[@id="${current.id}"]`;
                }
                
                if (current.className && typeof current.className === 'string') {
                    const firstClass = current.className.trim().split(/\s+/)[0];
                    if (firstClass) {
                        part += `[@class='${firstClass}']`;
                    }
                }
                
                parts.unshift(part);
                current = current.parentNode;
                depth++;
            }
            
            return '//' + parts.join('/');
        } catch(e) {
            console.error('Relative XPath error:', e);
            return 'Error generating XPath';
        }
    }
    
    // Get CSS Selector (simplified)
    function getCSSSelector(element) {
        try {
            if (!element || element.nodeType !== 1) return 'N/A';
            if (element.id) return `#${element.id}`;
            
            let selector = element.tagName.toLowerCase();
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/).filter(c => c).slice(0, 3).join('.');
                if (classes) selector += `.${classes}`;
            }
            
            return selector;
        } catch(e) {
            return 'Error generating selector';
        }
    }
    
    // Get event listeners
    function getEventListeners(element) {
        try {
            const listeners = [];
            const eventProps = ['onclick', 'onmouseover', 'onmouseout', 'onkeydown', 'onchange', 'onsubmit'];
            
            eventProps.forEach(prop => {
                if (element[prop]) {
                    listeners.push(prop.substring(2));
                }
            });
            
            return listeners.length > 0 ? listeners.join(', ') : 'None';
        } catch(e) {
            return 'Error';
        }
    }
    
    // Get inner text (limited)
    function getInnerText(element) {
        try {
            const text = (element.innerText || element.textContent || '').trim();
            return text.substring(0, 500);
        } catch(e) {
            return '';
        }
    }
    
    // Get input value
    function getInputValue(element) {
        try {
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'input') {
                const type = (element.type || 'text').toLowerCase();
                
                if (type === 'checkbox' || type === 'radio') {
                    return element.checked ? `checked (value: ${element.value})` : `unchecked (value: ${element.value})`;
                }
                
                return element.value || '(empty)';
            }
            
            if (tagName === 'textarea') {
                return element.value || '(empty)';
            }
            
            if (tagName === 'select') {
                const selectedOptions = Array.from(element.selectedOptions || []).map(opt => opt.value);
                return selectedOptions.length > 0 ? selectedOptions.join(', ') : '(none selected)';
            }
            
            return null;
        } catch(e) {
            return null;
        }
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Freeze element
    function freezeElement(element) {
        isFrozen = true;
        frozenElement = element;
        
        // Update highlight to new element
        highlightElement(element);
        
        if (currentHighlight) {
            currentHighlight.classList.add('frozen');
        }
        showNotification('Element frozen! 🔒 Click Release to unfreeze', 'success');
    }
    
    // Unfreeze element
    function unfreezeElement() {
        isFrozen = false;
        frozenElement = null;
        if (currentHighlight) {
            currentHighlight.classList.remove('frozen');
        }
        showNotification('Element released! 🔓', 'info');
    }
    
    // Create info tooltip
    function createTooltip(element) {
        try {
            // Remove existing tooltip
            if (tooltip) {
                tooltip.remove();
            }
            
            const tagName = element.tagName ? element.tagName.toLowerCase() : 'unknown';
            const id = element.id || '';
            const classesArray = element.className && typeof element.className === 'string' ? 
                                 element.className.trim().split(/\s+/).filter(c => c).slice(0, 10) : [];
            const classes = classesArray.join(', ');
            const absoluteXpath = getAbsoluteXPath(element);
            const relativeXpath = getRelativeXPath(element);
            const cssSelector = getCSSSelector(element);
            const listeners = getEventListeners(element);
            const innerText = getInnerText(element);
            const inputValue = getInputValue(element);
            
            // Get attributes (limited)
            const attributes = [];
            if (element.attributes) {
                const attrCount = Math.min(element.attributes.length, 20);
                for (let i = 0; i < attrCount; i++) {
                    const attr = element.attributes[i];
                    const value = attr.value.length > 100 ? attr.value.substring(0, 100) + '...' : attr.value;
                    attributes.push(`${attr.name}="${escapeHtml(value)}"`);
                }
            }
            
            tooltip = document.createElement('div');
            tooltip.className = 'inspector-tooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                padding: 0;
                z-index: 1000000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                width: 450px;
                max-height: 90vh;
                direction: ltr;
                text-align: left;
                display: flex;
                flex-direction: column;
                left: 20px;
                top: 100px;
            `;
            
            const infoItems = [
                { label: 'Tag Name', value: tagName, color: '#667eea', copyValue: tagName },
                { label: 'Element ID', value: id || 'none', color: '#43e97b', copyValue: id },
                { label: 'Classes', value: classes || 'none', color: '#f093fb', copyValue: classes },
                { label: 'Input Value', value: inputValue || 'N/A', color: '#ff6b6b', copyValue: inputValue || '', show: inputValue !== null },
                { label: 'Text Content', value: innerText || 'empty', color: '#a8edea', copyValue: innerText, show: innerText.length > 0 },
                { label: 'All Attributes', value: attributes.join('<br>') || 'none', color: '#fa709a', copyValue: attributes.join('\n') },
                { label: 'Absolute XPath', value: absoluteXpath, color: '#4facfe', copyValue: absoluteXpath },
                { label: 'Relative XPath', value: relativeXpath, color: '#30cfd0', copyValue: relativeXpath },
                { label: 'CSS Selector', value: cssSelector, color: '#a18cd1', copyValue: cssSelector },
                { label: 'Event Listeners', value: listeners, color: '#ff9a56', copyValue: listeners }
            ];
            
            const headerBg = isFrozen ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            const statusIcon = isFrozen ? '🔒' : '🔍';
            const statusText = isFrozen ? 'FROZEN' : 'Element Inspector';
            
            let html = `
                <div class="inspector-header" style="background:${headerBg};color:white;padding:14px 18px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none">
                    <span>${statusIcon} ${statusText}</span>
                    <div style="display:flex;gap:8px">
                        ${isFrozen ? '<button class="release-btn" style="background:rgba(255,255,255,0.3);border:none;color:white;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">🔓 Release</button>' : ''}
                        <button class="minimize-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">_</button>
                        <button class="copy-all-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">📋 All</button>
                    </div>
                </div>
            `;
            
            html += '<div class="inspector-content" style="padding:14px 18px;overflow-y:auto;flex:1;max-height:calc(90vh - 180px)">';
            infoItems.forEach((item, idx) => {
                if (item.show === false) return;
                const bg = idx % 2 === 0 ? '#fafbfc' : '#ffffff';
                html += `
                    <div style="margin-bottom:10px;padding:10px;background:${bg};border-radius:5px;border-left:4px solid ${item.color}">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                            <strong style="color:#555;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">${item.label}</strong>
                            <button class="copy-item-btn" data-copy="${escapeHtml(item.copyValue)}" style="background:${item.color};color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;transition:all 0.2s">📄 Copy</button>
                        </div>
                        <div style="color:#333;font-size:13px;line-height:1.6;word-break:break-word;max-height:120px;overflow:auto">${item.value}</div>
                    </div>
                `;
            });
            html += '</div>';
            
            html += `
                <div style="padding:12px 18px;background:#f8f9fa;border-top:1px solid #e0e0e0;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                        <button class="copy-tag-btn" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">📌 Tag</button>
                        <button class="copy-id-btn" style="background:linear-gradient(135deg,#43e97b 0%,#38f9d7 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">🆔 ID</button>
                        <button class="copy-classes-btn" style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">🎨 Classes</button>
                        <button class="copy-text-btn" style="background:linear-gradient(135deg,#a8edea 0%,#fed6e3 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">📝 Text</button>
                        <button class="copy-abs-xpath-btn" style="background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">🔗 Abs XPath</button>
                        <button class="copy-rel-xpath-btn" style="background:linear-gradient(135deg,#30cfd0 0%,#330867 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">🔗 Rel XPath</button>
                        <button class="copy-css-btn" style="background:linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">🎯 CSS</button>
                        <button class="copy-attrs-btn" style="background:linear-gradient(135deg,#fa709a 0%,#fee140 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">📋 Attrs</button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                        <button class="copy-outer-html-btn" style="background:linear-gradient(135deg,#ff9a56 0%,#ff6a88 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">📦 Outer HTML</button>
                        <button class="copy-inner-html-btn" style="background:linear-gradient(135deg,#ff6a88 0%,#ff99ac 100%);color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.2s">📄 Inner HTML</button>
                    </div>
                </div>
            `;
            
            tooltip.innerHTML = html;
            document.body.appendChild(tooltip);
            
            // Dragging
            const header = tooltip.querySelector('.inspector-header');
            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                const rect = tooltip.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            });
            
            // Release button
            const releaseBtn = tooltip.querySelector('.release-btn');
            if (releaseBtn) {
                releaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    unfreezeElement();
                    createTooltip(element);
                });
            }
            
            // Minimize
            tooltip.querySelector('.minimize-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const content = tooltip.querySelector('.inspector-content');
                const footer = content.nextElementSibling;
                if (isMinimized) {
                    content.style.display = 'block';
                    footer.style.display = 'block';
                    e.target.textContent = '_';
                    isMinimized = false;
                } else {
                    content.style.display = 'none';
                    footer.style.display = 'none';
                    e.target.textContent = '□';
                    isMinimized = true;
                }
            });
            
            tooltip.addEventListener('mouseenter', () => { isHoveringTooltip = true; });
            tooltip.addEventListener('mouseleave', () => { isHoveringTooltip = false; });
            
            // All copy buttons
            tooltip.querySelector('.copy-all-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const allInfo = infoItems.filter(i => i.show !== false).map(item => `${item.label}: ${item.copyValue}`).join('\n\n');
                copyToClipboard(allInfo, e.target);
                showNotification('All info copied!', 'success');
            });
            
            tooltip.querySelectorAll('.copy-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyToClipboard(btn.getAttribute('data-copy'), btn);
                    showNotification('Copied!', 'success');
                });
            });
            
            // Quick copy buttons
            tooltip.querySelector('.copy-tag-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(tagName, e.target);
                showNotification('Tag copied!', 'success');
            });
            
            tooltip.querySelector('.copy-id-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(id || '', e.target);
                showNotification(id ? 'ID copied!' : 'No ID to copy', id ? 'success' : 'warning');
            });
            
            tooltip.querySelector('.copy-classes-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(classes || '', e.target);
                showNotification(classes ? 'Classes copied!' : 'No classes to copy', classes ? 'success' : 'warning');
            });
            
            tooltip.querySelector('.copy-text-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(innerText || '', e.target);
                showNotification(innerText ? 'Text copied!' : 'No text to copy', innerText ? 'success' : 'warning');
            });
            
            tooltip.querySelector('.copy-abs-xpath-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(absoluteXpath, e.target);
                showNotification('Absolute XPath copied!', 'success');
            });
            
            tooltip.querySelector('.copy-rel-xpath-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(relativeXpath, e.target);
                showNotification('Relative XPath copied!', 'success');
            });
            
            tooltip.querySelector('.copy-css-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(cssSelector, e.target);
                showNotification('CSS Selector copied!', 'success');
            });
            
            tooltip.querySelector('.copy-attrs-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(attributes.join('\n'), e.target);
                showNotification('Attributes copied!', 'success');
            });
            
            tooltip.querySelector('.copy-outer-html-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(element.outerHTML, e.target);
                showNotification('Outer HTML copied!', 'success');
            });
            
            tooltip.querySelector('.copy-inner-html-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(element.innerHTML, e.target);
                showNotification('Inner HTML copied!', 'success');
            });
            
        } catch(e) {
            console.error('Tooltip error:', e);
        }
    }
    
    // Global mouse handlers
    document.addEventListener('mousemove', (e) => {
        if (isDragging && tooltip) {
            const left = e.clientX - dragOffset.x;
            const top = e.clientY - dragOffset.y;
            tooltip.style.left = `${Math.max(0, Math.min(window.innerWidth - tooltip.offsetWidth, left))}px`;
            tooltip.style.top = `${Math.max(0, Math.min(window.innerHeight - tooltip.offsetHeight, top))}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Double-click to freeze
    document.addEventListener('dblclick', (e) => {
        if (!inspectorEnabled) return;
        
        if (e.target.closest('.inspector-tooltip') || 
            e.target.closest('#inspector-toggle-btn')) {
            return;
        }
        
        e.preventDefault();
        
        // If already frozen on a different element, move to new element
        if (isFrozen && frozenElement !== e.target) {
            // Remove frozen class from old highlight
            if (currentHighlight) {
                currentHighlight.classList.remove('frozen');
            }
        }
        
        // Freeze the new element
        freezeElement(e.target);
        createTooltip(e.target);
    });
    
    // Highlight element
    function highlightElement(element) {
        try {
            if (currentHighlight) {
                const rect = element.getBoundingClientRect();
                currentHighlight.style.top = `${rect.top + window.scrollY}px`;
                currentHighlight.style.left = `${rect.left + window.scrollX}px`;
                currentHighlight.style.width = `${rect.width}px`;
                currentHighlight.style.height = `${rect.height}px`;
            } else {
                const rect = element.getBoundingClientRect();
                currentHighlight = document.createElement('div');
                currentHighlight.className = 'inspector-highlight-overlay';
                if (isFrozen) {
                    currentHighlight.classList.add('frozen');
                }
                currentHighlight.style.top = `${rect.top + window.scrollY}px`;
                currentHighlight.style.left = `${rect.left + window.scrollX}px`;
                currentHighlight.style.width = `${rect.width}px`;
                currentHighlight.style.height = `${rect.height}px`;
                document.body.appendChild(currentHighlight);
            }
        } catch(e) {
            console.error('Highlight error:', e);
        }
    }
    
    // Throttled mouse move handler
    function handleMouseMove(e) {
        if (!inspectorEnabled || isHoveringTooltip || isDragging || updatePending || isFrozen) return;
        
        if (e.target.closest('.inspector-tooltip') || 
            e.target.closest('#inspector-toggle-btn') ||
            e.target.classList.contains('inspector-highlight-overlay')) {
            return;
        }
        
        if (lastInspectedElement === e.target) return;
        
        updatePending = true;
        requestAnimationFrame(() => {
            lastInspectedElement = e.target;
            highlightElement(e.target);
            createTooltip(e.target);
            updatePending = false;
        });
    }
    
    // Toggle inspector
    function toggleInspector() {
        inspectorEnabled = !inspectorEnabled;
        const btn = document.getElementById('inspector-toggle-btn');
        
        if (inspectorEnabled) {
            document.addEventListener('mousemove', handleMouseMove);
            btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            showNotification('Inspector enabled! Double-click to freeze 🔒', 'success');
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            if (currentHighlight) currentHighlight.remove();
            if (tooltip) tooltip.remove();
            currentHighlight = null;
            tooltip = null;
            isFrozen = false;
            frozenElement = null;
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            showNotification('Inspector disabled', 'info');
        }
    }
    
    // Create toggle button
    function createToggleButton() {
        if (document.getElementById('inspector-toggle-btn')) return;
        
        const button = document.createElement('button');
        button.id = 'inspector-toggle-btn';
        button.innerHTML = '🔍';
        button.title = 'DOM Inspector';
        button.style.cssText = `
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            z-index: 999998;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        button.addEventListener('click', toggleInspector);
        document.body.appendChild(button);
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToggleButton);
    } else {
        createToggleButton();
    }
    
    console.log('✓ DOM Inspector ready');
    showNotification('DOM Inspector ready! Double-click to freeze 🔒', 'success');
    
})();
