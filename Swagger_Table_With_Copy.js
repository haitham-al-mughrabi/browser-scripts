// On-Demand Table Generator with Row Copy AND Nested Cell Copy + Notifications
(function() {
    // Color palettes
    const colorSchemes = [
        { header: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', even: '#f8f9ff', odd: '#ffffff', hover: '#e8e9ff' },
        { header: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', even: '#fff5f7', odd: '#ffffff', hover: '#ffe5eb' },
        { header: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', even: '#f0fbff', odd: '#ffffff', hover: '#e0f7ff' },
        { header: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', even: '#f0fff9', odd: '#ffffff', hover: '#e0fff3' },
        { header: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', even: '#fff9f0', odd: '#ffffff', hover: '#fff3e0' },
        { header: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', even: '#f0f9ff', odd: '#ffffff', hover: '#e0f2ff' },
        { header: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', even: '#fef9fb', odd: '#ffffff', hover: '#fef0f5' },
        { header: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)', even: '#fff5f5', odd: '#ffffff', hover: '#ffe8e8' }
    ];
    
    // Notification system
    function showNotification(message, type = 'info') {
        // Remove existing notification if any
        const existingNotif = document.querySelector('.table-gen-notification');
        if (existingNotif) {
            existingNotif.remove();
        }
        
        const colors = {
            'success': { bg: '#10b981', icon: '✓' },
            'info': { bg: '#3b82f6', icon: 'ℹ' },
            'warning': { bg: '#f59e0b', icon: '⚠' },
            'error': { bg: '#ef4444', icon: '✕' }
        };
        
        const config = colors[type] || colors['info'];
        
        const notif = document.createElement('div');
        notif.className = 'table-gen-notification';
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
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        notif.innerHTML = `<span style="font-size: 16px;">${config.icon}</span><span>${message}</span>`;
        document.body.appendChild(notif);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
    
    // Add animation styles if not already present
    if (!document.querySelector('style[data-table-gen-animations]')) {
        const style = document.createElement('style');
        style.setAttribute('data-table-gen-animations', 'true');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Copy to clipboard function
    function copyToClipboard(text, button, isCellCopy = false) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            const originalBg = button.style.background;
            button.textContent = '✓';
            button.style.background = '#10b981';
            
            // Show notification
            if (isCellCopy) {
                showNotification('Cell value copied! 📋', 'success');
            } else {
                showNotification('Row copied as JSON! 📋', 'success');
            }
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = originalBg;
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            showNotification('Failed to copy to clipboard', 'error');
        });
    }
    
    function formatValue(val, depth = 0) {
        if (val === null || val === undefined) {
            return '<span style="color:#999;font-style:italic">null</span>';
        }
        
        const scheme = colorSchemes[depth % colorSchemes.length];
        
        // Handle nested objects
        if (typeof val === 'object' && !Array.isArray(val)) {
            const nestedTableStyle = `width:100%;border-collapse:collapse;margin:8px 0;box-shadow:0 1px 4px rgba(0,0,0,0.08);border-radius:4px;overflow:hidden;border:2px solid ${scheme.even}`;
            const nestedTdStyle = `border:1px solid #e8e8e8;padding:6px 10px;font-size:12px;word-break:break-word;vertical-align:top;position:relative`;
            
            let nested = `<div style="margin:8px 0;padding-left:${depth * 12}px">`;
            nested += `<table style="${nestedTableStyle}">`;
            nested += '<tbody>';
            Object.entries(val).forEach(([k, v], idx) => {
                const bg = idx % 2 === 0 ? scheme.even : scheme.odd;
                const cellData = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
                nested += `<tr style="transition:background 0.15s ease" onmouseover="this.style.background='${scheme.hover}'" onmouseout="this.style.background='${bg}'">`;
                nested += `<td style="${nestedTdStyle};background:${bg};font-weight:600;color:#555;width:35%">${k}</td>`;
                nested += `<td style="${nestedTdStyle};background:${bg};position:relative" class="nested-copyable-cell" data-cell-value='${cellData.replace(/'/g, "&apos;")}'>
                    <div style="position:relative">
                        ${formatValue(v, depth + 1)}
                        <button class="copy-nested-cell-btn" style="display:none;position:absolute;top:0px;right:0px;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;transition:all 0.2s;z-index:10;box-shadow:0 2px 4px rgba(0,0,0,0.2)">📄</button>
                    </div>
                </td>`;
                nested += '</tr>';
            });
            nested += '</tbody></table></div>';
            return nested;
        }
        
        // Handle nested arrays
        if (Array.isArray(val)) {
            if (val.length === 0) return '<span style="color:#999;font-style:italic">[ empty array ]</span>';
            if (typeof val[0] === 'object') {
                const arrayBg = colorSchemes[(depth + 1) % colorSchemes.length].even;
                return `<details style="margin:6px 0;padding:8px;background:${arrayBg};border-radius:4px;border-left:3px solid ${scheme.header.match(/#[a-f0-9]{6}/i)?.[0] || '#667eea'}">` +
                       `<summary style="cursor:pointer;font-weight:600;color:#555;user-select:none">▸ Array with ${val.length} item${val.length > 1 ? 's' : ''}</summary>` + 
                       `<div style="margin-top:8px">${val.map((item, i) => `<div style="margin-bottom:6px"><strong style="color:#666;font-size:11px">Item ${i + 1}:</strong>${formatValue(item, depth + 1)}</div>`).join('')}</div>` +
                       '</details>';
            }
            return `<div style="font-family:monospace;background:#f5f5f5;padding:4px 8px;border-radius:3px;display:inline-block">${val.join(', ')}</div>`;
        }
        
        // Handle booleans
        if (typeof val === 'boolean') {
            const color = val ? '#10b981' : '#ef4444';
            return `<span style="color:${color};font-weight:600">${val}</span>`;
        }
        
        // Handle numbers
        if (typeof val === 'number') {
            return `<span style="color:#6366f1;font-weight:500">${val}</span>`;
        }
        
        return val;
    }
    
    function toTable(data) {
        if (!data) return '';
        let d = typeof data === 'string' ? JSON.parse(data) : data;
        
        const scheme = colorSchemes[0];
        const tableStyle = `width:100%;border-collapse:collapse;margin:15px 0;box-shadow:0 4px 12px rgba(0,0,0,0.1);background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e0e0e0`;
        const thStyle = `border:1px solid rgba(255,255,255,0.2);padding:14px 16px;background:${scheme.header};color:#fff;text-align:left;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px`;
        const tdStyle = `border:1px solid #e8e8e8;padding:12px 16px;word-wrap:break-word;word-break:break-word;max-width:450px;overflow-wrap:break-word;font-size:13px;line-height:1.6;vertical-align:top`;
        const valueTdStyle = `${tdStyle};position:relative`; // Only value cells get position:relative
        
        let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif" class="generated-table">`;
        html += `<table style="${tableStyle}">`;
        
        if (Array.isArray(d) && d[0]) {
            let keys = Object.keys(d[0]);
            html += '<thead><tr>';
            html += keys.map(k => `<th style="${thStyle}">${k}</th>`).join('');
            html += `<th style="${thStyle};width:50px;text-align:center">Copy</th>`;
            html += '</tr></thead><tbody>';
            d.forEach((row, idx) => {
                const rowBg = idx % 2 === 0 ? scheme.even : scheme.odd;
                html += `<tr style="transition:background 0.2s ease" onmouseover="this.style.background='${scheme.hover}'" onmouseout="this.style.background='${rowBg}'">`;
                html += keys.map(k => {
                    const val = row[k];
                    const cellData = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
                    return `<td style="${valueTdStyle};background:${rowBg}" class="copyable-cell" data-cell-value='${cellData.replace(/'/g, "&apos;")}'>
                        <div style="position:relative">
                            ${formatValue(val)}
                            <button class="copy-cell-btn" style="display:none;position:absolute;top:0px;right:0px;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;transition:all 0.2s;z-index:10;box-shadow:0 2px 4px rgba(0,0,0,0.2)">📄</button>
                        </div>
                    </td>`;
                }).join('');
                html += `<td style="${tdStyle};background:${rowBg};text-align:center;padding:8px" data-row-data='${JSON.stringify(row).replace(/'/g, "&apos;")}'>`;
                html += `<button class="copy-row-btn" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;transition:all 0.2s">📋</button>`;
                html += `</td>`;
                html += '</tr>';
            });
        } else if (typeof d === 'object') {
            html += '<thead><tr>';
            html += `<th style="${thStyle};width:32%">Property</th>`;
            html += `<th style="${thStyle}">Value</th>`;
            html += `<th style="${thStyle};width:50px;text-align:center">Copy</th>`;
            html += '</tr></thead><tbody>';
            Object.entries(d).forEach(([k,v], idx) => {
                const rowBg = idx % 2 === 0 ? scheme.even : scheme.odd;
                const rowData = {[k]: v};
                const cellData = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
                html += `<tr style="transition:background 0.2s ease" onmouseover="this.style.background='${scheme.hover}'" onmouseout="this.style.background='${rowBg}'">`;
                // Property name cell - NO copy button here
                html += `<td style="${tdStyle};background:${rowBg};font-weight:600;color:#555">${k}</td>`;
                // Value cell - WITH copy button
                html += `<td style="${valueTdStyle};background:${rowBg}" class="copyable-cell" data-cell-value='${cellData.replace(/'/g, "&apos;")}'>
                    <div style="position:relative">
                        ${formatValue(v)}
                        <button class="copy-cell-btn" style="display:none;position:absolute;top:0px;right:0px;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;transition:all 0.2s;z-index:10;box-shadow:0 2px 4px rgba(0,0,0,0.2)">📄</button>
                    </div>
                </td>`;
                html += `<td style="${tdStyle};background:${rowBg};text-align:center;padding:8px" data-row-data='${JSON.stringify(rowData).replace(/'/g, "&apos;")}'>`;
                html += `<button class="copy-row-btn" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;transition:all 0.2s">📋</button>`;
                html += `</td>`;
                html += '</tr>';
            });
        }
        html += '</tbody></table></div>';
        return html;
    }
    
    // Add event listeners to copy buttons
    function addCopyButtonListeners(tableContainer) {
        setTimeout(() => {
            // Row copy buttons
            const copyButtons = tableContainer.querySelectorAll('.copy-row-btn');
            copyButtons.forEach(btn => {
                if (!btn.dataset.listenerAdded) {
                    btn.dataset.listenerAdded = 'true';
                    
                    // Hover effects
                    btn.addEventListener('mouseenter', () => {
                        btn.style.transform = 'scale(1.1)';
                        btn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
                    });
                    btn.addEventListener('mouseleave', () => {
                        btn.style.transform = 'scale(1)';
                        btn.style.boxShadow = 'none';
                    });
                    
                    // Click handler
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const cell = btn.closest('td');
                        if (cell) {
                            try {
                                const rowData = JSON.parse(cell.getAttribute('data-row-data'));
                                const textToCopy = JSON.stringify(rowData, null, 2);
                                copyToClipboard(textToCopy, btn, false);
                            } catch(err) {
                                console.error('Copy error:', err);
                            }
                        }
                    });
                }
            });
            
            // Main table cell copy buttons - show on hover
            const copyableCells = tableContainer.querySelectorAll('.copyable-cell');
            copyableCells.forEach(cell => {
                const cellCopyBtn = cell.querySelector('.copy-cell-btn');
                if (cellCopyBtn && !cellCopyBtn.dataset.listenerAdded) {
                    cellCopyBtn.dataset.listenerAdded = 'true';
                    
                    // Show button on cell hover
                    cell.addEventListener('mouseenter', () => {
                        cellCopyBtn.style.display = 'block';
                    });
                    cell.addEventListener('mouseleave', () => {
                        cellCopyBtn.style.display = 'none';
                    });
                    
                    // Hover effects for button itself
                    cellCopyBtn.addEventListener('mouseenter', () => {
                        cellCopyBtn.style.transform = 'scale(1.15)';
                        cellCopyBtn.style.boxShadow = '0 3px 10px rgba(79, 172, 254, 0.5)';
                    });
                    cellCopyBtn.addEventListener('mouseleave', () => {
                        cellCopyBtn.style.transform = 'scale(1)';
                        cellCopyBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    });
                    
                    // Click handler for cell value copy
                    cellCopyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        try {
                            const cellValue = cell.getAttribute('data-cell-value');
                            copyToClipboard(cellValue, cellCopyBtn, true);
                        } catch(err) {
                            console.error('Cell copy error:', err);
                        }
                    });
                }
            });
            
            // Nested table cell copy buttons - show on hover
            const nestedCopyableCells = tableContainer.querySelectorAll('.nested-copyable-cell');
            nestedCopyableCells.forEach(cell => {
                const nestedCopyBtn = cell.querySelector('.copy-nested-cell-btn');
                if (nestedCopyBtn && !nestedCopyBtn.dataset.listenerAdded) {
                    nestedCopyBtn.dataset.listenerAdded = 'true';
                    
                    // Show button on cell hover
                    cell.addEventListener('mouseenter', () => {
                        nestedCopyBtn.style.display = 'block';
                    });
                    cell.addEventListener('mouseleave', () => {
                        nestedCopyBtn.style.display = 'none';
                    });
                    
                    // Hover effects for button itself
                    nestedCopyBtn.addEventListener('mouseenter', () => {
                        nestedCopyBtn.style.transform = 'scale(1.15)';
                        nestedCopyBtn.style.boxShadow = '0 3px 10px rgba(79, 172, 254, 0.5)';
                    });
                    nestedCopyBtn.addEventListener('mouseleave', () => {
                        nestedCopyBtn.style.transform = 'scale(1)';
                        nestedCopyBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    });
                    
                    // Click handler for nested cell value copy
                    nestedCopyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        try {
                            const cellValue = cell.getAttribute('data-cell-value');
                            copyToClipboard(cellValue, nestedCopyBtn, true);
                        } catch(err) {
                            console.error('Nested cell copy error:', err);
                        }
                    });
                }
            });
        }, 100);
    }
    
    function createTableButton(responseElement) {
        if (responseElement.querySelector('.table-generator-btn')) return;
        
        const button = document.createElement('button');
        button.textContent = '📊 Generate Table View';
        button.className = 'table-generator-btn';
        button.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            margin: 10px 0;
            box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        button.onmouseover = () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        };
        button.onmouseout = () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 2px 6px rgba(102, 126, 234, 0.3)';
        };
        
        button.addEventListener('click', function() {
            const microlightEl = responseElement.querySelector('.microlight');
            if (!microlightEl) return;
            
            generateTable(microlightEl, button);
        });
        
        const responseBody = responseElement.querySelector('.response-col_description');
        if (responseBody) {
            responseBody.insertBefore(button, responseBody.firstChild);
        }
    }
    
    function generateTable(microlightEl, generateBtn) {
        try {
            const tbl = toTable(microlightEl.textContent);
            if (tbl) {
                // Remove existing table if it exists
                let existingTable = microlightEl.previousElementSibling;
                if (existingTable && existingTable.classList.contains('generated-table')) {
                    existingTable.remove();
                }
                
                // Insert new table
                microlightEl.insertAdjacentHTML('beforebegin', tbl);
                
                // Update button to show regenerate option
                const tableContainer = microlightEl.previousElementSibling;
                if (tableContainer) {
                    addCopyButtonListeners(tableContainer);
                    
                    // Show notification
                    showNotification('Table generated successfully! 📊', 'success');
                    
                    // Update button state
                    generateBtn.textContent = '🔄 Regenerate Table';
                    generateBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                    generateBtn.style.boxShadow = '0 2px 6px rgba(245, 158, 11, 0.3)';
                    
                    // Change hover effect
                    generateBtn.onmouseover = () => {
                        generateBtn.style.transform = 'translateY(-2px)';
                        generateBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
                    };
                    generateBtn.onmouseout = () => {
                        generateBtn.style.transform = 'translateY(0)';
                        generateBtn.style.boxShadow = '0 2px 6px rgba(245, 158, 11, 0.3)';
                    };
                }
            } else {
                generateBtn.textContent = '⚠ Cannot generate table';
                generateBtn.style.background = '#ef4444';
                showNotification('Failed to generate table', 'error');
            }
        } catch(e) {
            generateBtn.textContent = '❌ Error generating table';
            generateBtn.style.background = '#ef4444';
            showNotification('Error generating table', 'error');
            console.error('Table generation error:', e);
        }
    }
    
    function addButtonsToResponses() {
        const responses = document.querySelectorAll('.responses-wrapper .response, .response-col_description');
        responses.forEach(response => {
            const microlight = response.querySelector('.microlight');
            if (microlight && !response.querySelector('.table-generator-btn')) {
                createTableButton(response.closest('.response') || response.closest('.responses-wrapper') || response);
            }
        });
    }
    
    const observer = new MutationObserver(() => {
        addButtonsToResponses();
    });
    
    const swaggerContainer = document.querySelector('#swagger-ui');
    if (swaggerContainer) {
        observer.observe(swaggerContainer, {
            childList: true,
            subtree: true
        });
        
        addButtonsToResponses();
        showNotification('Table generator initialized! ✓', 'success');
        console.log('✓ Table generator with notifications active');
    } else {
        console.error('✗ Swagger UI container not found');
    }
    
})();
