//
// For guidance on how to add JavaScript see:
// https://prototype-kit.service.gov.uk/docs/adding-css-javascript-and-images
//

window.GOVUKPrototypeKit.documentReady(() => {
  document.querySelectorAll('.js-print-link').forEach((link) => {
    link.classList.remove('msh-print-link--hidden')
    link.addEventListener('click', (event) => {
      event.preventDefault()
      window.print()
    })
  })
})
