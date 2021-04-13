window.RevealMermaid = window.RevealMermaid || {
    id: 'RevealMermaid',
    init: function (deck) {
        initMermaid(deck);
    }
};

function buildDiagrams(slide) {
    slide.querySelectorAll("code.mermaid").forEach(m => {
        // Use div instead of pre.code to avoid reveal CSS
        let newDiv = document.createElement("div")
        newDiv.classList.add('mermaid')
        m.parentNode.parentNode.replaceChild(newDiv, m.parentNode)

        // Mermaid expects just the text, reveal adds spans to code blocks
        newDiv.innerHTML = m.innerText

        // Center the diagram
        newDiv.style.display = 'flex'
        newDiv.style.justifyContent = 'center'
    })
}

const initMermaid = function (Reveal) {
    Reveal.addEventListener('ready', function (event) {
        Reveal.getSlides().forEach(slide => buildDiagrams(slide))
        mermaid.initialize({ theme: 'dark' })
    })
}
