const appWindowName = 'ClinGen'

// localStorage keys used to remember FSM state and related app state
const appStateKeys = {
  LOOKUP_TYPE: `${appWindowName}_lookupType`,
  LOOKUP_INSTANCE_INDIVIDUAL: `${appWindowName}_lookupInstanceIndividual`,
  LOOKUP_INSTANCE_FAMILY: `${appWindowName}_lookupInstanceFamily`,
  LOOKUP_INSTANCE_GROUP: `${appWindowName}_lookupInstanceGroup`,
}

function setAppVar(key, value) {
  localStorage.setItem(key, value)
}

function getAppVar(key) {
  const value = localStorage.getItem(key)
  return (typeof value !== 'undefined') ? value : null
}

function setLookupInstance(type, num) {
  const key = getLookupKey(type)
  setAppVar(key, num)
}

function getLookupInstance(type) {
  const key = getLookupKey(type)
  const value = getAppVar(key)
  return value ? value : '1'
}

function getLookupKey(type) {
  let key 
  if (type === 'individual') {
    key = appStateKeys.LOOKUP_INSTANCE_INDIVIDUAL
  }
  if (type === 'family') {
    key = appStateKeys.LOOKUP_INSTANCE_FAMILY
  }
  if (type === 'group') {
    key = appStateKeys.LOOKUP_INSTANCE_GROUP    
  }
  return key
}

// custom elements

class LabeledIntegerSelect extends HTMLElement {
  type
  count
  constructor() {
    super()
  }
  connectedCallback() {
    this.type = this.getAttribute('type')
    this.count = this.getAttribute('count')
    this.innerHTML = `
      <span class="integer-select-type">${this.type}</span>
      <select is="integer-select" type="${this.type}" count="${this.count}"></select>
      `
  }
}
customElements.define('labeled-integer-select', LabeledIntegerSelect)

class LabeledIntegerSelectCollection extends HTMLElement {
  static handler(e) {
    console.log(JSON.stringify(e.detail))
    // downside of using a static method to export this handler: can only have one of these elements in the document
    const element = document.querySelector('labeled-integer-select-collection') 
    const integerSelects = Array.from(element.querySelectorAll('labeled-integer-select'))
    for (let integerSelect of integerSelects) {
      const label = integerSelect.querySelector('.integer-select-type')
      if (label.innerText === e.detail.type) {
        label.setAttribute('selected', true)
        label.style.fontWeight = 'bold'
      } else {
        label.removeAttribute('selected')
        label.style.fontWeight = 'normal'
      }
    }
  }
  constructor() {
    super()
    this.addEventListener('labeled-integer-select-event', LabeledIntegerSelectCollection.handler)
  }
  connectedCallback() {
    const firstLabeledIntegerSelect = this.querySelector('labeled-integer-select')
    firstLabeledIntegerSelect.setAttribute('selected', true)
    firstLabeledIntegerSelect.querySelector('.integer-select-type').style.fontWeight = 'bold'
  }
}
customElements.define('labeled-integer-select-collection', LabeledIntegerSelectCollection)

class IntegerSelect extends HTMLSelectElement {
  type
  constructor() {
    super()
    this.type = this.getAttribute('type')
  }
  relaySelection() {
    const e = new CustomEvent('labeled-integer-select-event', { 
      detail: {
        type: this.type,
        value: this.options[this.selectedIndex].value
      }
    })
  const closestLabeledIntegerSelectCollection = this.closest('labeled-integer-select-collection')
  if (closestLabeledIntegerSelectCollection) {
    closestLabeledIntegerSelectCollection.dispatchEvent(e)
  }
  dispatchEvent(e)
}
  connectedCallback() {
    const count = parseInt(this.getAttribute('count'))
    let options = ''
    const lookupInstance = parseInt(getLookupInstance(this.type))
    for (let i = 1; i < count; i++) {
      let selected = ( i == lookupInstance ) ? 'selected' : ''
      options += `<option ${selected}>${i}</option>`
    }
    this.innerHTML = options
    this.onclick = this.relaySelection
  }
}
customElements.define('integer-select', IntegerSelect, { extends: "select" })



