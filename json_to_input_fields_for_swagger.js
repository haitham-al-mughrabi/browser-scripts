// Complete Form & Table Converter with Proper Swagger Integration
(function() {
    
    // Toast Notification System
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('swagger-toast-container') || createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `swagger-toast ${type}`;
        toast.style.cssText = `
            background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                         type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                         'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};
            color: white;
            padding: 14px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-in 2.7s;
            position: relative;
            overflow: hidden;
        `;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `
            <span style="font-size: 18px; font-weight: bold;">${icon}</span>
            <span>${message}</span>
            <div style="position: absolute; bottom: 0; left: 0; height: 3px; background: rgba(255,255,255,0.3); width: 100%; animation: progress 3s linear;"></div>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'swagger-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            @keyframes fadeOut {
                to { opacity: 0.7; }
            }
            @keyframes progress {
                from { width: 100%; }
                to { width: 0%; }
            }
        `;
        document.head.appendChild(style);
        
        return container;
    }
    
    // Function to trigger Swagger UI to recognize the change
    function triggerSwaggerUpdate(textarea) {
        // Trigger input event
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(inputEvent);
        
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(changeEvent);
        
        // For React components, try to trigger React's onChange
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(textarea, textarea.value);
        
        const reactEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(reactEvent);
        
        // Focus and blur to ensure Swagger registers the change
        textarea.focus();
        setTimeout(() => textarea.blur(), 50);
    }
    
    // Form Generation Functions (keeping previous implementations)
    function createInputField(key, value, parentPath = '', level = 0, showRemove = false) {
        const fieldPath = parentPath ? `${parentPath}.${key}` : key;
        const fieldId = `field-${fieldPath.replace(/\./g, '-').replace(/\[/g, '-').replace(/\]/g, '')}`;
        
        let inputHTML = '';
        const labelStyle = 'display:block;font-weight:600;color:#555;margin-bottom:4px;font-size:13px';
        const containerStyle = `margin-bottom:12px;padding:${12 - level * 2}px;background:${level % 2 === 0 ? '#f9f9f9' : '#fff'};border-radius:6px;border-left:3px solid ${getColorForLevel(level)}`;
        
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        
        inputHTML += `<div style="${containerStyle}" data-field-container="${fieldPath}">`;
        inputHTML += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">`;
        inputHTML += `<label for="${fieldId}" style="${labelStyle};margin:0;flex:1">${key}</label>`;
        
        inputHTML += `<select class="type-switcher" data-field-id="${fieldId}" data-field-path="${fieldPath}" data-field-key="${key}"
            style="padding:4px 8px;border:2px solid #e0e0e0;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;background:#fff;color:#667eea">
            <option value="string" ${valueType === 'string' ? 'selected' : ''}>String</option>
            <option value="number" ${valueType === 'number' ? 'selected' : ''}>Number</option>
            <option value="boolean" ${valueType === 'boolean' ? 'selected' : ''}>Boolean</option>
            <option value="array" ${valueType === 'array' ? 'selected' : ''}>Array</option>
            <option value="object" ${valueType === 'object' && value !== null ? 'selected' : ''}>Object</option>
            <option value="null" ${value === null ? 'selected' : ''}>Null</option>
        </select>`;
        
        if (showRemove) {
            inputHTML += `<button class="remove-field-btn" data-field-path="${fieldPath}" 
                style="background:#ef4444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">
                ✕
            </button>`;
        }
        
        inputHTML += `</div>`;
        inputHTML += `<div id="${fieldId}-container">`;
        inputHTML += generateInputByType(fieldId, fieldPath, value, valueType, level, key);
        inputHTML += `</div>`;
        inputHTML += `</div>`;
        return inputHTML;
    }
    
    function generateInputByType(fieldId, fieldPath, value, valueType, level, fieldKey = '') {
        const inputStyle = 'width:100%;padding:8px 12px;border:2px solid #e0e0e0;border-radius:4px;font-size:13px;transition:border-color 0.2s;font-family:monospace';
        let html = '';
        
        switch(valueType) {
            case 'boolean':
                html += `<div style="display:flex;align-items:center;gap:10px">`;
                html += `<input type="checkbox" id="${fieldId}" data-field-path="${fieldPath}" data-field-type="boolean" ${value ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">`;
                html += `<span style="color:#666;font-size:12px">${value ? 'True' : 'False'}</span>`;
                html += `</div>`;
                break;
                
            case 'number':
                html += `<input type="number" id="${fieldId}" data-field-path="${fieldPath}" data-field-type="number" value="${value || 0}" style="${inputStyle}" 
                    onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">`;
                break;
                
            case 'array':
                html += createArrayField(fieldKey, value, fieldPath, level);
                break;
                
            case 'object':
                if (value === null) {
                    html += `<input type="text" id="${fieldId}" data-field-path="${fieldPath}" data-field-type="null" value="null" readonly style="${inputStyle};background:#f5f5f5;cursor:not-allowed">`;
                } else {
                    html += createObjectField(value, fieldPath, level);
                }
                break;
                
            case 'null':
                html += `<input type="text" id="${fieldId}" data-field-path="${fieldPath}" data-field-type="null" value="null" readonly style="${inputStyle};background:#f5f5f5;cursor:not-allowed">`;
                break;
                
            default:
                if (String(value).length > 50) {
                    html += `<textarea id="${fieldId}" data-field-path="${fieldPath}" data-field-type="string" rows="3" style="${inputStyle};resize:vertical" 
                        onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">${value}</textarea>`;
                } else {
                    html += `<input type="text" id="${fieldId}" data-field-path="${fieldPath}" data-field-type="string" value="${value}" style="${inputStyle}" 
                        onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">`;
                }
        }
        
        return html;
    }
    
    function createObjectField(obj, fieldPath, level) {
        let html = '';
        html += `<details open style="margin-top:8px;padding:12px;background:#fff;border:2px solid ${getColorForLevel(level + 1)};border-radius:6px" data-object-container="${fieldPath}">`;
        html += `<summary style="cursor:pointer;font-weight:600;color:${getColorForLevel(level + 1)};margin-bottom:12px;user-select:none;display:flex;justify-content:space-between;align-items:center">`;
        html += `<span>▸ Object (${Object.keys(obj).length} properties)</span>`;
        html += `<button class="add-object-field-btn" data-object-path="${fieldPath}" 
            style="background:${getColorForLevel(level + 1)};color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600" 
            onclick="event.stopPropagation()">
            + Add Field
        </button>`;
        html += `</summary>`;
        html += `<div class="object-fields-container" data-field-path="${fieldPath}" data-field-type="object" style="margin-left:12px">`;
        
        Object.entries(obj).forEach(([nestedKey, nestedValue]) => {
            html += createInputField(nestedKey, nestedValue, fieldPath, level + 1, true);
        });
        
        html += `</div></details>`;
        return html;
    }
    
    function getColorForLevel(level) {
        const colors = ['#667eea', '#43e97b', '#f093fb', '#4facfe', '#fa709a', '#30cfd0'];
        return colors[level % colors.length];
    }
    
    function createArrayField(key, array, fieldPath, level) {
        let html = '';
        const isPrimitiveArray = array.length === 0 || !['object', 'array'].includes(typeof array[0]);
        
        html += `<div style="margin-top:8px;padding:12px;background:#fff;border:2px solid ${getColorForLevel(level + 1)};border-radius:6px" data-array-container="${fieldPath}" data-field-type="array">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">`;
        html += `<strong style="color:${getColorForLevel(level + 1)}">📋 Array (${array.length} items)</strong>`;
        html += `<button class="add-array-item-btn" data-array-path="${fieldPath}" data-is-primitive="${isPrimitiveArray}" 
            style="background:${getColorForLevel(level + 1)};color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">
            + Add Item
        </button>`;
        html += `</div>`;
        
        html += `<div class="array-items-container">`;
        
        if (isPrimitiveArray) {
            array.forEach((item, index) => {
                html += createPrimitiveArrayItem(item, `${fieldPath}[${index}]`, index);
            });
        } else {
            array.forEach((item, index) => {
                html += createComplexArrayItem(item, `${fieldPath}[${index}]`, index, level);
            });
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function createPrimitiveArrayItem(value, path, index) {
        const itemType = typeof value;
        let html = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#f5f5f5;border-radius:4px" data-array-item="${path}">`;
        html += `<span style="font-weight:600;color:#666;min-width:30px">#${index}</span>`;
        
        if (itemType === 'boolean') {
            html += `<input type="checkbox" data-field-path="${path}" data-field-type="boolean" ${value ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">`;
        } else if (itemType === 'number') {
            html += `<input type="number" data-field-path="${path}" data-field-type="number" value="${value}" style="flex:1;padding:6px 10px;border:2px solid #e0e0e0;border-radius:4px">`;
        } else {
            html += `<input type="text" data-field-path="${path}" data-field-type="string" value="${value}" style="flex:1;padding:6px 10px;border:2px solid #e0e0e0;border-radius:4px">`;
        }
        
        html += `<button class="remove-array-item-btn" data-item-path="${path}" 
            style="background:#ef4444;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">
            🗑
        </button>`;
        html += `</div>`;
        return html;
    }
    
    function createComplexArrayItem(item, path, index, level) {
        let html = `<details open style="margin-bottom:12px;padding:12px;background:#fafafa;border:2px solid #e0e0e0;border-radius:6px" data-array-item="${path}">`;
        html += `<summary style="cursor:pointer;font-weight:600;color:#555;margin-bottom:8px;user-select:none;display:flex;justify-content:space-between;align-items:center">`;
        html += `<span>▸ Item ${index}</span>`;
        html += `<button class="remove-array-item-btn" data-item-path="${path}" 
            style="background:#ef4444;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600" 
            onclick="event.stopPropagation()">
            🗑 Remove
        </button>`;
        html += `</summary>`;
        html += `<div style="margin-left:12px">`;
        
        Object.entries(item).forEach(([key, value]) => {
            html += createInputField(key, value, path, level + 2, true);
        });
        
        html += `</div></details>`;
        return html;
    }
    
    function generateFormFromJSON(jsonData) {
        let formHTML = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" class="root-form-container">';
        
        formHTML += `<div style="margin-bottom:16px;display:flex;justify-content:flex-end">`;
        formHTML += `<button class="add-root-field-btn" 
            style="background:linear-gradient(135deg,#43e97b 0%,#38f9d7 100%);color:white;border:none;padding:8px 16px;border-radius:5px;cursor:pointer;font-weight:600;font-size:13px;box-shadow:0 2px 6px rgba(67,233,123,0.3);transition:all 0.2s">
            + Add Root Field
        </button>`;
        formHTML += `</div>`;
        
        formHTML += '<div class="root-fields-container">';
        Object.entries(jsonData).forEach(([key, value]) => {
            formHTML += createInputField(key, value, '', 0, true);
        });
        formHTML += '</div>';
        
        formHTML += '</div>';
        return formHTML;
    }
    
    function setupObjectHandlers(container) {
        container.querySelectorAll('.add-object-field-btn').forEach(btn => {
            btn.removeEventListener('click', btn._clickHandler);
            btn._clickHandler = function(e) {
                e.stopPropagation();
                const objectPath = this.getAttribute('data-object-path');
                const objectContainer = container.querySelector(`[data-object-container="${objectPath}"]`);
                const fieldsContainer = objectContainer.querySelector('.object-fields-container');
                
                const fieldName = prompt('Enter new field name:');
                if (!fieldName) return;
                
                const existingField = fieldsContainer.querySelector(`[data-field-container="${objectPath}.${fieldName}"]`);
                if (existingField) {
                    showToast('Field already exists!', 'error');
                    return;
                }
                
                const newFieldHTML = createInputField(fieldName, '', objectPath, 1, true);
                fieldsContainer.insertAdjacentHTML('beforeend', newFieldHTML);
                showToast(`Field "${fieldName}" added successfully`, 'success');
                setupAllHandlers(container);
            };
            btn.addEventListener('click', btn._clickHandler);
        });
        
        container.querySelectorAll('.remove-field-btn').forEach(btn => {
            btn.removeEventListener('click', btn._clickHandler);
            btn._clickHandler = function() {
                const fieldPath = this.getAttribute('data-field-path');
                const fieldContainer = container.querySelector(`[data-field-container="${fieldPath}"]`);
                if (fieldContainer && confirm('Remove this field?')) {
                    const fieldName = fieldPath.split('.').pop();
                    fieldContainer.remove();
                    showToast(`Field "${fieldName}" removed`, 'info');
                }
            };
            btn.addEventListener('click', btn._clickHandler);
        });
    }
    
    function setupRootFieldHandlers(container) {
        const addRootBtn = container.querySelector('.add-root-field-btn');
        if (addRootBtn) {
            addRootBtn.addEventListener('click', function() {
                const rootFieldsContainer = container.querySelector('.root-fields-container');
                const fieldName = prompt('Enter new root field name:');
                if (!fieldName) return;
                
                const existingField = rootFieldsContainer.querySelector(`[data-field-container="${fieldName}"]`);
                if (existingField) {
                    showToast('Field already exists!', 'error');
                    return;
                }
                
                const newFieldHTML = createInputField(fieldName, '', '', 0, true);
                rootFieldsContainer.insertAdjacentHTML('beforeend', newFieldHTML);
                showToast(`Root field "${fieldName}" added successfully`, 'success');
                setupAllHandlers(container);
            });
        }
    }
    
    function setupTypeSwitchers(container) {
        container.querySelectorAll('.type-switcher').forEach(select => {
            select.removeEventListener('change', select._changeHandler);
            select._changeHandler = function() {
                const fieldId = this.getAttribute('data-field-id');
                const fieldPath = this.getAttribute('data-field-path');
                const fieldKey = this.getAttribute('data-field-key');
                const newType = this.value;
                const fieldContainer = document.getElementById(`${fieldId}-container`);
                
                let defaultValue;
                switch(newType) {
                    case 'string': defaultValue = ''; break;
                    case 'number': defaultValue = 0; break;
                    case 'boolean': defaultValue = false; break;
                    case 'array': defaultValue = []; break;
                    case 'object': defaultValue = {}; break;
                    case 'null': defaultValue = null; break;
                }
                
                fieldContainer.innerHTML = generateInputByType(fieldId, fieldPath, defaultValue, newType, 0, fieldKey);
                showToast(`Field type changed to ${newType}`, 'info');
                setupAllHandlers(container);
            };
            select.addEventListener('change', select._changeHandler);
        });
    }
    
    function setupArrayHandlers(container) {
        container.querySelectorAll('.add-array-item-btn').forEach(btn => {
            btn.removeEventListener('click', btn._clickHandler);
            btn._clickHandler = function() {
                const arrayPath = this.getAttribute('data-array-path');
                const isPrimitive = this.getAttribute('data-is-primitive') === 'true';
                const arrayContainer = container.querySelector(`[data-array-container="${arrayPath}"]`);
                const itemsContainer = arrayContainer.querySelector('.array-items-container');
                const currentItems = itemsContainer.querySelectorAll('[data-array-item]').length;
                
                let newItemHTML = '';
                if (isPrimitive) {
                    newItemHTML = createPrimitiveArrayItem('', `${arrayPath}[${currentItems}]`, currentItems);
                } else {
                    newItemHTML = createComplexArrayItem({}, `${arrayPath}[${currentItems}]`, currentItems, 0);
                }
                
                itemsContainer.insertAdjacentHTML('beforeend', newItemHTML);
                showToast('Array item added', 'success');
                setupAllHandlers(container);
            };
            btn.addEventListener('click', btn._clickHandler);
        });
        
        container.querySelectorAll('.remove-array-item-btn').forEach(btn => {
            btn.removeEventListener('click', btn._clickHandler);
            btn._clickHandler = function(e) {
                e.stopPropagation();
                const itemPath = this.getAttribute('data-item-path');
                const item = container.querySelector(`[data-array-item="${itemPath}"]`);
                if (item && confirm('Remove this item?')) {
                    item.remove();
                    showToast('Array item removed', 'info');
                }
            };
            btn.addEventListener('click', btn._clickHandler);
        });
    }
    
    function setupAllHandlers(container) {
        setupTypeSwitchers(container);
        setupArrayHandlers(container);
        setupObjectHandlers(container);
        setupRootFieldHandlers(container);
    }
    
    function collectFormData(container) {
        const data = {};
        const inputs = container.querySelectorAll('[data-field-path][data-field-type]');
        
        inputs.forEach(input => {
            const path = input.getAttribute('data-field-path');
            const type = input.getAttribute('data-field-type');
            
            let value;
            switch(type) {
                case 'boolean':
                    value = input.checked;
                    break;
                case 'number':
                    value = parseFloat(input.value) || 0;
                    break;
                case 'null':
                    value = null;
                    break;
                case 'object':
                case 'array':
                    return;
                default:
                    value = input.value;
            }
            
            setNestedValue(data, path, value);
        });
        
        return data;
    }
    
    function setNestedValue(obj, path, value) {
        const keys = path.split(/\.|\[|\]/).filter(k => k !== '');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            const nextKey = keys[i + 1];
            
            if (!current[key]) {
                current[key] = isNaN(nextKey) ? {} : [];
            }
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
    }
    
    function addFormButton(requestBodyElement) {
        if (requestBodyElement.querySelector('.form-generator-btn')) return;
        
        const button = document.createElement('button');
        button.textContent = '📝 Convert to Form Fields';
        button.className = 'form-generator-btn';
        button.style.cssText = `
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            margin: 10px 0;
            box-shadow: 0 2px 6px rgba(67, 233, 123, 0.3);
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        button.onmouseover = () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 12px rgba(67, 233, 123, 0.4)';
        };
        button.onmouseout = () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 2px 6px rgba(67, 233, 123, 0.3)';
        };
        
        button.addEventListener('click', function() {
            const bodyTextarea = requestBodyElement.querySelector('textarea.body-param__text');
            if (!bodyTextarea) return;
            
            if (bodyTextarea.dataset.formGenerated === 'true') {
                showToast('Form already generated!', 'error');
                return;
            }
            
            try {
                const jsonData = JSON.parse(bodyTextarea.value);
                const formHTML = generateFormFromJSON(jsonData);
                
                const formContainer = document.createElement('div');
                formContainer.className = 'dynamic-form-container';
                formContainer.style.cssText = 'margin:15px 0;padding:20px;background:#fff;border:2px solid #43e97b;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1)';
                formContainer.innerHTML = formHTML;
                
                setupAllHandlers(formContainer);
                
                const updateBtn = document.createElement('button');
                updateBtn.textContent = '✓ Update JSON from Form';
                updateBtn.style.cssText = `
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                    margin-top: 15px;
                    box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                `;
                
                updateBtn.addEventListener('click', () => {
                    const formData = collectFormData(formContainer);
                    const jsonString = JSON.stringify(formData, null, 2);
                    bodyTextarea.value = jsonString;
                    
                    // CRITICAL: Trigger Swagger UI to recognize the change
                    triggerSwaggerUpdate(bodyTextarea);
                    
                    showToast('JSON updated and synced with Swagger!', 'success');
                });
                
                formContainer.appendChild(updateBtn);
                
                const toggleTextarea = document.createElement('button');
                toggleTextarea.textContent = '👁 Toggle JSON View';
                toggleTextarea.style.cssText = 'margin-left:10px;padding:10px 20px;background:#f3f4f6;border:2px solid #e0e0e0;border-radius:5px;cursor:pointer;font-weight:600;font-size:13px';
                toggleTextarea.addEventListener('click', () => {
                    bodyTextarea.style.display = bodyTextarea.style.display === 'none' ? 'block' : 'none';
                    toggleTextarea.textContent = bodyTextarea.style.display === 'none' ? '👁 Show JSON View' : '👁 Hide JSON View';
                });
                formContainer.appendChild(toggleTextarea);
                
                bodyTextarea.parentNode.insertBefore(formContainer, bodyTextarea);
                bodyTextarea.dataset.formGenerated = 'true';
                bodyTextarea.style.display = 'none';
                
                button.textContent = '✓ Form Generated';
                button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                button.disabled = true;
                showToast('Form generated successfully!', 'success');
                
            } catch(e) {
                button.textContent = '❌ Invalid JSON';
                button.style.background = '#ef4444';
                showToast('Error: Invalid JSON format', 'error');
                console.error('Error:', e);
            }
        });
        
        const bodyParamWrapper = requestBodyElement.closest('.body-param') || requestBodyElement.closest('.parameters');
        if (bodyParamWrapper) {
            bodyParamWrapper.insertBefore(button, bodyParamWrapper.firstChild);
        }
    }
    
    function addFormButtonsToRequests() {
        const requestBodies = document.querySelectorAll('textarea.body-param__text');
        requestBodies.forEach(textarea => {
            if (!textarea.closest('.body-param').querySelector('.form-generator-btn')) {
                addFormButton(textarea.closest('.body-param') || textarea.parentElement);
            }
        });
    }
    
    const observer = new MutationObserver(() => addFormButtonsToRequests());
    
    const swaggerContainer = document.querySelector('#swagger-ui');
    if (swaggerContainer) {
        observer.observe(swaggerContainer, { childList: true, subtree: true });
        addFormButtonsToRequests();
        showToast('🚀 Swagger Form & Table Converter Ready!', 'success');
        console.log('✓ Swagger enhancement script initialized');
    } else {
        console.error('✗ Swagger UI container not found');
    }
    
})();
