function clearViewportScale() {
  const style = document.documentElement.style
  style.transform = ''
  style.transformOrigin = ''
  style.width = ''
  style.height = ''
  style.overflow = ''
}

function init() {
  clearViewportScale()
  window.addEventListener('resize', clearViewportScale)
}

export default init
