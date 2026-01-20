// DOM Tree Viewer with Element Inspector, Search, Mouse Tracking & UI Controls
(function() {
    'use strict';

    let treePanel = null;
    let selectedElement = null;
    let highlightOverlay = null;
    let expandedNodes = new Set();
    let searchResults = [];
    let currentSearchIndex = -1;
    let mouseTrackingEnabled = false;
    let lastHoveredElement = null;
    let trackingTimeout = null;
    let isMinimized = false;
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let resizeType = null;
    let panelState = {
        width: 900,
        height: null,
        top: 60,
        left: null,
        right: 20
    };

    // Notification system
    function showNotification(message, type = 'info') {
        const existingNotif = document.querySelector('.tree-notification');
        if (existingNotif) existingNotif.remove();

        const colors = {
            'success': { bg: '#10b981', icon: '✓' },
            'info': { bg: '#3b82f6', icon: 'ℹ' },
            'warning': { bg: '#f59e0b', icon: '⚠' }
        };

        const config = colors[type] || colors['info'];

        const notif = document.createElement('div');
        notif.className = 'tree-notification';
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
            font-size: 14px;
            font-weight: 500;
            z-index: 1000002;
            animation: slideIn 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        notif.innerHTML = `<span style="font-size: 18px;">${config.icon}</span><span>${message}</span>`;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    // Add styles
    if (!document.querySelector('style[data-tree-styles]')) {
        const style = document.createElement('style');
        style.setAttribute('data-tree-styles', 'true');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            .tree-highlight {
                position: absolute;
                pointer-events: none;
                border: 2px solid #f59e0b;
                background: rgba(245, 158, 11, 0.1);
                z-index: 999999;
                box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
                transition: all 0.2s ease;
            }
            .tree-node {
                user-select: none;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.15s;
                font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
                font-size: 13px;
                line-height: 1.6;
            }
            .tree-node:hover {
                background: rgba(102, 126, 234, 0.1);
            }
            .tree-node.selected {
                background: rgba(102, 126, 234, 0.2);
                font-weight: 600;
            }
            .tree-node.hover-tracked {
                background: rgba(236, 72, 153, 0.2);
                border-left: 3px solid #ec4899;
                animation: glow 1.5s ease-in-out infinite;
            }
            @keyframes glow {
                0%, 100% { box-shadow: 0 0 5px rgba(236, 72, 153, 0.3); }
                50% { box-shadow: 0 0 15px rgba(236, 72, 153, 0.6); }
            }
            .tree-node.search-match {
                background: rgba(251, 191, 36, 0.3);
                border-left: 3px solid #f59e0b;
            }
            .tree-node.search-active {
                background: rgba(16, 185, 129, 0.3);
                border-left: 3px solid #10b981;
                animation: pulse 1s ease-in-out infinite;
            }
            @keyframes pulse {
                0%, 100% { background: rgba(16, 185, 129, 0.3); }
                50% { background: rgba(16, 185, 129, 0.5); }
            }
            .tree-children {
                margin-left: 20px;
                border-left: 1px solid #e0e0e0;
                padding-left: 8px;
            }
            .tree-toggle {
                display: inline-block;
                width: 16px;
                text-align: center;
                margin-right: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            .tree-tag {
                color: #667eea;
                font-weight: 600;
            }
            .tree-id {
                color: #10b981;
                font-weight: 500;
            }
            .tree-class {
                color: #f59e0b;
            }
            .tree-text {
                color: #6b7280;
                font-style: italic;
            }
            .tree-panel::-webkit-scrollbar {
                width: 10px;
            }
            .tree-panel::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            .tree-panel::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }
            .tree-panel::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
            .search-input {
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: border-color 0.2s;
            }
            .search-input:focus {
                outline: none;
                border-color: #667eea;
            }
            .resize-handle {
                position: absolute;
                z-index: 10;
            }
            .resize-handle-right {
                right: 0;
                top: 0;
                bottom: 0;
                width: 8px;
                cursor: ew-resize;
            }
            .resize-handle-bottom {
                left: 0;
                right: 0;
                bottom: 0;
                height: 8px;
                cursor: ns-resize;
            }
            .resize-handle-corner {
                right: 0;
                bottom: 0;
                width: 16px;
                height: 16px;
                cursor: nwse-resize;
            }
            .resize-handle:hover {
                background: rgba(102, 126, 234, 0.2);
            }
            .panel-header {
                cursor: move;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    // Copy to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            showNotification('Failed to copy', 'warning');
        });
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Inspect element in DevTools
    function inspectElementInDevTools(element) {
        if (element && element.nodeType === Node.ELEMENT_NODE) {
            window.$inspectedElement = element;

            if (typeof inspect === 'function') {
                inspect(element);
                showNotification('Element opened in DevTools! 🔍', 'success');
            } else {
                console.log('🔍 Inspected Element:', element);
                showNotification('Element logged to console as $inspectedElement', 'info');
            }
        }
    }

    // Find tree node for element
    function findTreeNodeForElement(element) {
        const allNodes = document.querySelectorAll('.tree-node');
        for (let node of allNodes) {
            if (node.__element__ === element) {
                return node;
            }
        }
        return null;
    }

    // Expand tree to show node
    function expandToNode(node) {
        let parent = node.parentElement;
        while (parent) {
            if (parent.classList && parent.classList.contains('tree-children')) {
                parent.style.display = 'block';
                const prevSibling = parent.previousElementSibling;
                if (prevSibling && prevSibling.classList.contains('tree-node')) {
                    const toggle = prevSibling.querySelector('.tree-toggle');
                    if (toggle) toggle.textContent = '▼';
                    if (prevSibling.__element__) {
                        expandedNodes.add(prevSibling.__element__);
                    }
                }
            }
            parent = parent.parentElement;
        }
    }

    // Highlight element in tree from mouse hover
    function highlightElementInTree(element) {
        if (!element || !treePanel) return;

        if (element.closest('#tree-viewer-panel') || element.id === 'tree-toggle-btn') {
            return;
        }

        const node = findTreeNodeForElement(element);
        if (!node) return;

        document.querySelectorAll('.tree-node').forEach(n => {
            n.classList.remove('hover-tracked');
        });

        node.classList.add('hover-tracked');
        expandToNode(node);

        const treeContent = document.getElementById('tree-content');
        if (treeContent) {
            const nodeRect = node.getBoundingClientRect();
            const containerRect = treeContent.getBoundingClientRect();

            if (nodeRect.top < containerRect.top || nodeRect.bottom > containerRect.bottom) {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        highlightElement(element);
    }

    // Mouse tracking handler
    function handleMouseTracking(e) {
        if (!mouseTrackingEnabled || !treePanel) return;

        const element = e.target;
        if (element === lastHoveredElement) return;

        lastHoveredElement = element;

        clearTimeout(trackingTimeout);
        trackingTimeout = setTimeout(() => {
            highlightElementInTree(element);
        }, 100);
    }

    // Toggle mouse tracking
    function toggleMouseTracking() {
        mouseTrackingEnabled = !mouseTrackingEnabled;

        const btn = document.getElementById('toggle-tracking-btn');
        if (btn) {
            if (mouseTrackingEnabled) {
                btn.style.background = 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)';
                btn.innerHTML = '🎯 Tracking ON';
                showNotification('Mouse tracking enabled! Hover over elements', 'success');
                document.addEventListener('mousemove', handleMouseTracking);
            } else {
                btn.style.background = 'rgba(255,255,255,0.2)';
                btn.innerHTML = '🎯 Track Mouse';
                showNotification('Mouse tracking disabled', 'info');
                document.removeEventListener('mousemove', handleMouseTracking);

                document.querySelectorAll('.tree-node').forEach(n => {
                    n.classList.remove('hover-tracked');
                });
            }
        }
    }

    // Minimize/Maximize panel
    function toggleMinimize() {
        const content = document.getElementById('tree-main-content');
        const btn = document.getElementById('minimize-btn');

        if (!content || !btn) return;

        isMinimized = !isMinimized;

        if (isMinimized) {
            content.style.display = 'none';
            btn.innerHTML = '🔲';
            treePanel.style.height = 'auto';
            showNotification('Panel minimized', 'info');
        } else {
            content.style.display = 'flex';
            btn.innerHTML = '—';
            updatePanelSize();
            showNotification('Panel restored', 'info');
        }
    }

    // Update panel size
    function updatePanelSize() {
        if (!treePanel || isMinimized) return;

        if (panelState.height) {
            treePanel.style.height = panelState.height + 'px';
        } else {
            treePanel.style.height = 'calc(100vh - 140px)';
        }

        treePanel.style.width = panelState.width + 'px';

        if (panelState.left !== null) {
            treePanel.style.left = panelState.left + 'px';
            treePanel.style.right = 'auto';
        } else {
            treePanel.style.right = panelState.right + 'px';
            treePanel.style.left = 'auto';
        }

        treePanel.style.top = panelState.top + 'px';
    }

    // Search for elements
    function searchElements(query) {
        if (!query || query.trim().length < 2) {
            clearSearch();
            showNotification('Enter at least 2 characters to search', 'warning');
            return;
        }

        query = query.trim().toLowerCase();
        searchResults = [];

        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.closest('#tree-viewer-panel') || element.id === 'tree-toggle-btn') {
                return;
            }

            let matches = false;

            if (element.tagName.toLowerCase().includes(query)) {
                matches = true;
            }

            if (element.id && element.id.toLowerCase().includes(query)) {
                matches = true;
            }

            if (element.className && typeof element.className === 'string') {
                const classes = element.className.toLowerCase();
                if (classes.includes(query)) {
                    matches = true;
                }
            }

            if (element.attributes) {
                for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i];
                    if (attr.name.toLowerCase().includes(query) || 
                        attr.value.toLowerCase().includes(query)) {
                        matches = true;
                        break;
                    }
                }
            }

            if (matches) {
                searchResults.push(element);
            }
        });

        if (searchResults.length > 0) {
            showNotification(`Found ${searchResults.length} match${searchResults.length > 1 ? 'es' : ''}`, 'success');
            highlightSearchResults();
            currentSearchIndex = 0;
            focusSearchResult(0);
        } else {
            showNotification('No matches found', 'warning');
            clearSearch();
        }

        updateSearchCounter();
    }

    // Highlight search results
    function highlightSearchResults() {
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('search-match', 'search-active');
        });

        searchResults.forEach(element => {
            const node = findTreeNodeForElement(element);
            if (node) {
                node.classList.add('search-match');
            }
        });
    }

    // Focus on specific search result
    function focusSearchResult(index) {
        if (index < 0 || index >= searchResults.length) return;

        const element = searchResults[index];
        const node = findTreeNodeForElement(element);

        if (node) {
            document.querySelectorAll('.tree-node').forEach(n => {
                n.classList.remove('search-active');
            });

            node.classList.add('search-active');
            expandToNode(node);
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.click();
        }
    }

    // Navigate search results
    function nextSearchResult() {
        if (searchResults.length === 0) return;
        currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
        focusSearchResult(currentSearchIndex);
        updateSearchCounter();
    }

    function prevSearchResult() {
        if (searchResults.length === 0) return;
        currentSearchIndex = currentSearchIndex - 1;
        if (currentSearchIndex < 0) currentSearchIndex = searchResults.length - 1;
        focusSearchResult(currentSearchIndex);
        updateSearchCounter();
    }

    // Update search counter
    function updateSearchCounter() {
        const counter = document.getElementById('search-counter');
        if (counter) {
            if (searchResults.length > 0) {
                counter.textContent = `${currentSearchIndex + 1} / ${searchResults.length}`;
                counter.style.display = 'block';
            } else {
                counter.style.display = 'none';
            }
        }
    }

    // Clear search
    function clearSearch() {
        searchResults = [];
        currentSearchIndex = -1;
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('search-match', 'search-active');
        });
        updateSearchCounter();
    }

    // Highlight element
    function highlightElement(element) {
        if (element.nodeType !== Node.ELEMENT_NODE) return;

        if (!highlightOverlay) {
            highlightOverlay = document.createElement('div');
            highlightOverlay.className = 'tree-highlight';
            document.body.appendChild(highlightOverlay);
        }

        const rect = element.getBoundingClientRect();
        highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
        highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
        highlightOverlay.style.width = `${rect.width}px`;
        highlightOverlay.style.height = `${rect.height}px`;
        highlightOverlay.style.display = 'block';
    }

    // Remove highlight
    function removeHighlight() {
        if (highlightOverlay) {
            highlightOverlay.style.display = 'none';
        }
    }

    // Show element details
    function showElementDetails(element) {
        if (element.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = element.tagName.toLowerCase();
        const id = element.id || 'none';
        const classes = element.className && typeof element.className === 'string'
            ? element.className.trim().split(/\s+/).filter(c => c)
            : [];

        const attributes = [];
        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                if (attr.name !== 'class' && attr.name !== 'id') {
                    const value = attr.value.length > 50 ? attr.value.substring(0, 50) + '...' : attr.value;
                    attributes.push({ name: attr.name, value });
                }
            }
        }

        let html = `
            <div style="padding: 16px; background: #f8f9fa; border-bottom: 2px solid #667eea;">
                <h3 style="margin: 0 0 12px 0; color: #667eea; font-size: 16px; font-weight: 700;">
                    📋 Element Details
                </h3>
            </div>
            <div style="padding: 16px;">
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #555; font-size: 12px; text-transform: uppercase;">Tag Name</strong>
                        <button onclick="(${copyToClipboard.toString()})('${tag}')" style="background: #667eea; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Copy</button>
                    </div>
                    <div style="background: #f0f4ff; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #667eea; font-family: monospace;">
                        ${tag}
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #555; font-size: 12px; text-transform: uppercase;">ID</strong>
                        ${id !== 'none' ? `<button onclick="(${copyToClipboard.toString()})('${id}')" style="background: #10b981; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Copy</button>` : ''}
                    </div>
                    <div style="background: #f0fdf4; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #10b981; font-family: monospace; color: ${id === 'none' ? '#999' : '#333'};">
                        ${id}
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #555; font-size: 12px; text-transform: uppercase;">Classes (${classes.length})</strong>
                        ${classes.length > 0 ? `<button onclick="(${copyToClipboard.toString()})('${classes.join(' ')}')" style="background: #f59e0b; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Copy All</button>` : ''}
                    </div>
                    <div style="background: #fffbeb; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #f59e0b; max-height: 150px; overflow-y: auto;">
                        ${classes.length > 0 
                            ? classes.map(c => `<div style="font-family: monospace; padding: 4px 0; border-bottom: 1px solid #fef3c7; color: #92400e;">${escapeHtml(c)}</div>`).join('')
                            : '<span style="color: #999; font-style: italic;">No classes</span>'}
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #555; font-size: 12px; text-transform: uppercase;">Other Attributes (${attributes.length})</strong>
                    </div>
                    <div style="background: #fef2f2; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #ef4444; max-height: 200px; overflow-y: auto;">
                        ${attributes.length > 0
                            ? attributes.map(attr => `
                                <div style="margin-bottom: 8px; padding: 6px; background: white; border-radius: 3px;">
                                    <div style="font-family: monospace; color: #991b1b; font-weight: 600; margin-bottom: 2px;">${escapeHtml(attr.name)}</div>
                                    <div style="font-family: monospace; color: #666; font-size: 12px; word-break: break-all;">${escapeHtml(attr.value)}</div>
                                </div>
                            `).join('')
                            : '<span style="color: #999; font-style: italic;">No other attributes</span>'}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px;">
                    <button onclick="(${inspectElementInDevTools.toString()})(this.parentElement.parentElement.__element__)" style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        🔍 Inspect in DevTools
                    </button>
                    <button onclick="console.log(this.parentElement.parentElement.__element__)" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        📍 Log to Console
                    </button>
                    <button onclick="this.parentElement.parentElement.__element__.scrollIntoView({behavior: 'smooth', block: 'center'})" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        🎯 Scroll to View
                    </button>
                    <button onclick="(${copyToClipboard.toString()})(this.parentElement.parentElement.__element__.outerHTML)" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        📦 Copy HTML
                    </button>
                </div>
            </div>
        `;

        return html;
    }

    // Create tree node
    function createTreeNode(element, level = 0) {
        if (!element) return null;

        if (element.nodeType === Node.ELEMENT_NODE) {
            const tag = element.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || 
                element.id === 'tree-viewer-panel' || 
                element.id === 'tree-toggle-btn' ||
                element.classList.contains('tree-notification')) {
                return null;
            }
        }

        const nodeDiv = document.createElement('div');

        if (element.nodeType === Node.TEXT_NODE) {
            const text = element.textContent.trim();
            if (!text) return null;

            nodeDiv.className = 'tree-node';
            nodeDiv.innerHTML = `<span class="tree-text">${escapeHtml(text.substring(0, 100))}${text.length > 100 ? '...' : ''}</span>`;
            return nodeDiv;
        }

        if (element.nodeType !== Node.ELEMENT_NODE) return null;

        const hasChildren = element.children.length > 0;
        const nodeId = `node-${Math.random().toString(36).substr(2, 9)}`;
        const isExpanded = expandedNodes.has(element) || level < 2;

        if (isExpanded) expandedNodes.add(element);

        const tag = element.tagName.toLowerCase();
        const id = element.id ? ` <span class="tree-id">#${element.id}</span>` : '';
        const classes = element.className && typeof element.className === 'string' && element.className.trim()
            ? ` <span class="tree-class">.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}</span>`
            : '';

        const toggle = hasChildren 
            ? `<span class="tree-toggle">${isExpanded ? '▼' : '▶'}</span>`
            : `<span class="tree-toggle" style="opacity: 0.3;">○</span>`;

        nodeDiv.className = 'tree-node';
        nodeDiv.innerHTML = `${toggle}<span class="tree-tag">&lt;${tag}&gt;</span>${id}${classes}`;
        nodeDiv.dataset.nodeId = nodeId;
        nodeDiv.__element__ = element;

        nodeDiv.addEventListener('click', (e) => {
            e.stopPropagation();

            if (hasChildren && e.target.classList.contains('tree-toggle')) {
                const childrenDiv = nodeDiv.nextElementSibling;
                const toggleIcon = nodeDiv.querySelector('.tree-toggle');

                if (childrenDiv && childrenDiv.classList.contains('tree-children')) {
                    const isCurrentlyExpanded = childrenDiv.style.display !== 'none';
                    childrenDiv.style.display = isCurrentlyExpanded ? 'none' : 'block';
                    toggleIcon.textContent = isCurrentlyExpanded ? '▶' : '▼';

                    if (isCurrentlyExpanded) {
                        expandedNodes.delete(element);
                    } else {
                        expandedNodes.add(element);
                    }
                }
                return;
            }

            document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
            nodeDiv.classList.add('selected');
            selectedElement = element;

            const detailsDiv = document.getElementById('tree-element-details');
            if (detailsDiv) {
                detailsDiv.innerHTML = showElementDetails(element);
                detailsDiv.__element__ = element;
            }

            highlightElement(element);
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        nodeDiv.addEventListener('mouseenter', () => {
            if (element.nodeType === Node.ELEMENT_NODE) {
                highlightElement(element);
            }
        });

        nodeDiv.addEventListener('mouseleave', () => {
            if (selectedElement !== element) {
                removeHighlight();
            }
        });

        const container = document.createElement('div');
        container.appendChild(nodeDiv);

        if (hasChildren) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            childrenDiv.style.display = isExpanded ? 'block' : 'none';

            Array.from(element.children).forEach(child => {
                const childNode = createTreeNode(child, level + 1);
                if (childNode) {
                    childrenDiv.appendChild(childNode);
                }
            });

            container.appendChild(childrenDiv);
        }

        return container;
    }

    // Build tree
    function buildTree() {
        if (!treePanel) return;

        const treeContent = document.getElementById('tree-content');
        if (!treeContent) return;

        treeContent.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">🔄 Building tree...</div>';

        setTimeout(() => {
            treeContent.innerHTML = '';
            const tree = createTreeNode(document.documentElement, 0);
            if (tree) {
                treeContent.appendChild(tree);
            }
            showNotification('Tree built successfully!', 'success');
        }, 100);
    }

    // Setup resize handlers
    function setupResizeHandlers() {
        const rightHandle = treePanel.querySelector('.resize-handle-right');
        const bottomHandle = treePanel.querySelector('.resize-handle-bottom');
        const cornerHandle = treePanel.querySelector('.resize-handle-corner');

        const startResize = (e, type) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            resizeType = type;

            const rect = treePanel.getBoundingClientRect();
            dragOffset.x = e.clientX;
            dragOffset.y = e.clientY;
            dragOffset.width = rect.width;
            dragOffset.height = rect.height;
            dragOffset.left = rect.left;
        };

        rightHandle.addEventListener('mousedown', (e) => startResize(e, 'right'));
        bottomHandle.addEventListener('mousedown', (e) => startResize(e, 'bottom'));
        cornerHandle.addEventListener('mousedown', (e) => startResize(e, 'corner'));
    }

    // Setup drag handlers
    function setupDragHandlers() {
        const header = treePanel.querySelector('.panel-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
                return;
            }

            isDragging = true;
            const rect = treePanel.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        });
    }

    // Global mouse handlers
    document.addEventListener('mousemove', (e) => {
        if (isDragging && treePanel) {
            const left = e.clientX - dragOffset.x;
            const top = e.clientY - dragOffset.y;

            panelState.left = Math.max(0, Math.min(window.innerWidth - treePanel.offsetWidth, left));
            panelState.top = Math.max(0, Math.min(window.innerHeight - 100, top));
            panelState.right = null;

            updatePanelSize();
        }

        if (isResizing && treePanel) {
            const deltaX = e.clientX - dragOffset.x;
            const deltaY = e.clientY - dragOffset.y;

            if (resizeType === 'right' || resizeType === 'corner') {
                const newWidth = dragOffset.width + (panelState.left !== null ? deltaX : -deltaX);
                panelState.width = Math.max(400, Math.min(window.innerWidth - 40, newWidth));
            }

            if (resizeType === 'bottom' || resizeType === 'corner') {
                const newHeight = dragOffset.height + deltaY;
                panelState.height = Math.max(300, Math.min(window.innerHeight - panelState.top - 20, newHeight));
            }

            updatePanelSize();
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        resizeType = null;
    });

    // Create tree panel
    function createTreePanel() {
        if (treePanel) {
            treePanel.remove();
            treePanel = null;
            removeHighlight();
            clearSearch();
            mouseTrackingEnabled = false;
            document.removeEventListener('mousemove', handleMouseTracking);
            showNotification('Tree viewer closed', 'info');
            return;
        }

        treePanel = document.createElement('div');
        treePanel.id = 'tree-viewer-panel';
        treePanel.style.cssText = `
            position: fixed;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            z-index: 1000000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
        `;

        treePanel.innerHTML = `
            <div class="panel-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; border-radius: 12px 12px 0 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 700;">🌳 DOM Tree Viewer</h2>
                    <div style="display: flex; gap: 8px;">
                        <button id="toggle-tracking-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">🎯 Track Mouse</button>
                        <button id="refresh-tree-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">🔄</button>
                        <button id="collapse-all-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">📁</button>
                        <button id="minimize-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">—</button>
                        <button id="close-tree-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">✕</button>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="flex: 1; position: relative;">
                        <input type="text" id="tree-search-input" class="search-input" placeholder="Search by tag, class, ID, or attribute..." style="padding-right: 100px; background: rgba(255,255,255,0.95); color: #333;">
                        <span id="search-counter" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #667eea; font-weight: 600; font-size: 12px; display: none;"></span>
                    </div>
                    <button id="prev-result-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;" title="Previous (Shift+Enter)">↑</button>
                    <button id="next-result-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;" title="Next (Enter)">↓</button>
                    <button id="clear-search-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">✕</button>
                </div>
            </div>
            <div id="tree-main-content" style="display: flex; flex: 1; overflow: hidden;">
                <div id="tree-content" class="tree-panel" style="flex: 1; overflow-y: auto; padding: 16px; border-right: 2px solid #e0e0e0;">
                </div>
                <div id="tree-element-details" style="width: 350px; overflow-y: auto; background: #fafbfc;">
                    <div style="padding: 40px 20px; text-align: center; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 12px;">👆</div>
                        <div style="font-size: 14px;">Click on any element in the tree to view its details</div>
                    </div>
                </div>
            </div>
            <div class="resize-handle resize-handle-right"></div>
            <div class="resize-handle resize-handle-bottom"></div>
            <div class="resize-handle resize-handle-corner"></div>
        `;

        document.body.appendChild(treePanel);
        updatePanelSize();

        // Event listeners
        document.getElementById('close-tree-btn').addEventListener('click', createTreePanel);
        document.getElementById('refresh-tree-btn').addEventListener('click', buildTree);
        document.getElementById('toggle-tracking-btn').addEventListener('click', toggleMouseTracking);
        document.getElementById('minimize-btn').addEventListener('click', toggleMinimize);

        document.getElementById('collapse-all-btn').addEventListener('click', () => {
            expandedNodes.clear();
            buildTree();
            showNotification('All nodes collapsed', 'info');
        });

        // Search functionality
        const searchInput = document.getElementById('tree-search-input');
        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchElements(e.target.value);
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    prevSearchResult();
                } else {
                    nextSearchResult();
                }
            }
        });

        document.getElementById('next-result-btn').addEventListener('click', nextSearchResult);
        document.getElementById('prev-result-btn').addEventListener('click', prevSearchResult);
        document.getElementById('clear-search-btn').addEventListener('click', () => {
            searchInput.value = '';
            clearSearch();
            showNotification('Search cleared', 'info');
        });

        setupDragHandlers();
        setupResizeHandlers();
        buildTree();
        showNotification('Tree viewer opened! Drag to move, resize from edges', 'success');
    }

    // Create toggle button
    function createToggleButton() {
        if (document.getElementById('tree-toggle-btn')) return;

        const button = document.createElement('button');
        button.id = 'tree-toggle-btn';
        button.innerHTML = '🌳';
        button.title = 'DOM Tree Viewer';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 28px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            z-index: 999998;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        button.addEventListener('click', createTreePanel);
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });

        document.body.appendChild(button);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToggleButton);
    } else {
        createToggleButton();
    }

    console.log('✓ DOM Tree Viewer ready');
    showNotification('DOM Tree Viewer ready! 🌳', 'success');

})();
