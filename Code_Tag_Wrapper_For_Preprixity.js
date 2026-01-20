// Working solution for Perplexity-style code blocks
function wrapCodeBlocks() {
  // Target pre tags with the specific class
  const preBlocks = document.querySelectorAll('pre.not-prose:not(.accordion-wrapped)');
  
  console.log('Found code blocks:', preBlocks.length);
  
  preBlocks.forEach((preTag) => {
    // Mark as wrapped to avoid duplicates
    preTag.classList.add('accordion-wrapped');
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'code-accordion';
    wrapper.style.cssText = 'margin: 10px 0; border: 1px solid #444; border-radius: 6px; overflow: hidden;';
    
    // Create header button
    const header = document.createElement('button');
    header.className = 'accordion-header';
    header.textContent = '▶ Show Code';
    header.style.cssText = `
      width: 100%;
      padding: 10px 15px;
      background: #1e1e1e;
      border: none;
      color: #d4d4d4;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
      border-bottom: 1px solid #444;
    `;
    
    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'accordion-content';
    content.style.display = 'none'; // Collapsed by default
    
    // Insert before pre tag
    preTag.parentNode.insertBefore(wrapper, preTag);
    wrapper.appendChild(header);
    wrapper.appendChild(content);
    content.appendChild(preTag);
    
    // Toggle on click
    header.addEventListener('click', () => {
      if (content.style.display === 'none') {
        content.style.display = 'block';
        header.textContent = '▼ Hide Code';
      } else {
        content.style.display = 'none';
        header.textContent = '▶ Show Code';
      }
    });
  });
}

// Run immediately
wrapCodeBlocks();

// Watch for new code blocks (for dynamically loaded content)
const observer = new MutationObserver(() => {
  wrapCodeBlocks();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('Code accordion script loaded!');
