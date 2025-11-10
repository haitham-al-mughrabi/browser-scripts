(async function extractOTPFromMailpit() {
  try {
    // Use XPath to find the first message link
    const xpath = '//div[@class="list-group"]/a';
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    
    const firstMessage = result.singleNodeValue;
    
    if (!firstMessage) {
      console.error('❌ No messages found');
      showPopup('No messages found', false);
      return;
    }
    
    // Click the latest message
    firstMessage.click();
    console.log('📧 Clicked latest email');
    
    // Wait for email content to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find the specific iframe
    const iframe = document.getElementById('preview-html');
    
    if (!iframe) {
      console.error('❌ Email preview iframe not found');
      showPopup('Email preview not found', false);
      return;
    }
    
    // Access iframe content
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Find the OTP in the h1 tag
    const h1Element = iframeDoc.querySelector('h1');
    
    if (h1Element) {
      const otp = h1Element.textContent.trim();
      
      // Validate it's a 6-digit OTP
      if (/^\d{6}$/.test(otp)) {
        // Try to copy to clipboard
        const copied = await copyTextToClipboard(otp);
        showPopup(otp, copied);
        return otp;
      } else {
        console.error('❌ Found h1, but not a valid 6-digit OTP:', otp);
        showPopup('Invalid OTP format: ' + otp, false);
      }
    } else {
      console.error('❌ h1 element not found in email');
      showPopup('OTP not found in email', false);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    showPopup('Error: ' + error.message, false);
  }
  
  // Copy to clipboard function
  async function copyTextToClipboard(text) {
    // Try the modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        console.log('Text copied using Clipboard API');
        return true;
      } catch (err) {
        console.warn('Clipboard API failed', err);
      }
    }
    
    // Fallback to execCommand
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
      
      if (successful) {
        console.log('Text copied using execCommand');
        return true;
      }
    } catch (err) {
      console.warn('execCommand failed', err);
    }
    
    return false;
  }
  
  // Show popup function
  function showPopup(otp, copied) {
    // Remove any existing popup
    const existingElement = document.getElementById('otp-popup');
    if (existingElement) {
      document.body.removeChild(existingElement);
    }
    
    // Create popup container
    const container = document.createElement('div');
    container.id = 'otp-popup';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.zIndex = '10000';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '25px';
    container.style.borderRadius = '10px';
    container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    container.style.minWidth = '350px';
    container.style.textAlign = 'center';
    
    // Title
    const title = document.createElement('div');
    title.textContent = '🔐 OTP Code';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '15px';
    title.style.color = '#333';
    
    // OTP input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = otp;
    input.style.width = '100%';
    input.style.padding = '12px';
    input.style.fontSize = '24px';
    input.style.fontWeight = 'bold';
    input.style.textAlign = 'center';
    input.style.marginBottom = '15px';
    input.style.border = '2px solid #4CAF50';
    input.style.borderRadius = '5px';
    input.style.boxSizing = 'border-box';
    input.style.letterSpacing = '3px';
    input.readOnly = true;
    
    // Status message
    const status = document.createElement('div');
    if (copied) {
      status.textContent = '✅ Copied to clipboard!';
      status.style.color = '#4CAF50';
    } else {
      status.textContent = '⚠️ Click "Copy" button or select text above';
      status.style.color = '#ff9800';
    }
    status.style.fontSize = '14px';
    status.style.marginBottom = '15px';
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'center';
    
    // Copy button
    const copyButton = document.createElement('button');
    copyButton.textContent = '📋 Copy';
    copyButton.style.padding = '10px 20px';
    copyButton.style.fontSize = '14px';
    copyButton.style.backgroundColor = '#4CAF50';
    copyButton.style.color = 'white';
    copyButton.style.border = 'none';
    copyButton.style.borderRadius = '5px';
    copyButton.style.cursor = 'pointer';
    copyButton.style.fontWeight = 'bold';
    copyButton.onclick = function() {
      input.select();
      document.execCommand('copy');
      status.textContent = '✅ Copied to clipboard!';
      status.style.color = '#4CAF50';
    };
    
    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✖ Close';
    closeButton.style.padding = '10px 20px';
    closeButton.style.fontSize = '14px';
    closeButton.style.backgroundColor = '#f44336';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontWeight = 'bold';
    closeButton.onclick = function() {
      document.body.removeChild(container);
    };
    
    // Assemble the popup
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);
    
    container.appendChild(title);
    container.appendChild(input);
    container.appendChild(status);
    container.appendChild(buttonContainer);
    document.body.appendChild(container);
    
    // Select text for easy copying
    input.select();
    
    // Auto-close after 10 seconds if copied successfully
    if (copied) {
      setTimeout(function() {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }, 10000);
    }
  }
})();
