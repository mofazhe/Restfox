class AlertConfirmPrompt extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: 'open' })
    }

    createDialog = (type: 'prompt' | 'confirm' | 'alert', title: string, defaultValue = '', selectList = []) => {
        const div = document.createElement('div')

        let inputHtml = ''
        if (type === 'prompt') {
            if (title.toLowerCase().includes('color')) {
                inputHtml = `
                <div style="margin-top: 0.5rem;">
                    <input type="color" value="${defaultValue ?? '#000000'}" class="color-preview" id="dialog-color-input">
                </div>
                `
            }  else if(title.toLowerCase().includes('in seconds')) {
                inputHtml = `
                <div style="margin-top: 0.5rem;">
                    <input type="number" value="${defaultValue ?? ''}" list="selectList" class="dialog-input" id="dialog-input" spellcheck="false">
                    <datalist id="selectList">
                        ${selectList.map(item => `<option value="${item}"></option>`).join('')}
                    </datalist>
                </div>
                `
            } else {
                inputHtml = `
                <div style="margin-top: 0.5rem;">
                    <input type="text" value="${defaultValue ?? ''}" list="selectList" class="dialog-input" id="dialog-input" spellcheck="false">
                    <datalist id="selectList">
                        ${selectList.map(item => `<option value="${item}"></option>`).join('')}
                    </datalist>
                </div>
                `
            }
        }

        div.innerHTML = `
        <div class="dialog-container">
            <div class="dialog dialog-${type}">
                <div>${title}</div>
                ${inputHtml}
                <div style="margin-top: 1rem; text-align: right; user-select: none;">
                    <button class="dialog-primary-button" id="dialog-confirm">OK</button>
                    ${type !== 'alert' ? '<button class="dialog-secondary-button" id="dialog-cancel">Cancel</button>' : ''}
                </div>
            </div>
        </div>
        `

        const shadowRoot = this.shadowRoot

        if (shadowRoot === null) {
            throw new Error('Shadow root is null')
        }

        shadowRoot.querySelector('#root')?.appendChild(div)

        if (type === 'prompt') {
            if (title.toLowerCase().includes('color')) {
                shadowRoot.getElementById('dialog-color-input')?.focus()
            } else {
                shadowRoot.getElementById('dialog-input')?.focus()
                ;(shadowRoot.getElementById('dialog-input') as HTMLInputElement).select()
            }
        } else {
            shadowRoot.getElementById('dialog-confirm')?.focus()
        }

        return new Promise((resolve) => {
            if (this === null) {
                throw new Error('Shadow root is null')
            }

            const closeModal = () => {
                shadowRoot.removeEventListener('click', eventHandler)
                shadowRoot.removeEventListener('keyup', eventHandler)
                shadowRoot.removeEventListener('keydown', eventHandler)
                shadowRoot.querySelector('#root')?.removeChild(div)
            }

            const confirm = () => {
                if (type === 'prompt') {
                    if (title.toLowerCase().includes('color')) {
                        resolve((shadowRoot.getElementById('dialog-color-input') as HTMLInputElement).value)
                    } else {
                        resolve((shadowRoot.getElementById('dialog-input') as HTMLInputElement).value)
                    }
                } else {
                    resolve(true)
                }
                closeModal()
            }

            const cancel = () => {
                resolve(type === 'prompt' ? null : false)
                closeModal()
            }

            const eventHandler = (e: any) => {
                if (e.type === 'keyup') {
                    if (e.key === 'Enter') {
                        confirm()
                    }

                    if (e.key === 'Escape') {
                        cancel()
                    }

                    return
                }

                // Trap focus inside dialog
                if (e.type === 'keydown') {
                    const focusableEls = div.querySelectorAll('button:not(:disabled), input[type="text"]:not(:disabled), input[type="color"]:not(:disabled)') as NodeListOf<HTMLElement>
                    const firstFocusableEl = focusableEls[0]
                    const lastFocusableEl = focusableEls[focusableEls.length - 1]

                    const isTabPressed = e.key === 'Tab'
                    if (!isTabPressed) {
                        return
                    }

                    if (e.shiftKey) {
                        if (shadowRoot && shadowRoot.activeElement === firstFocusableEl) {
                            lastFocusableEl.focus()
                            e.preventDefault()
                        }
                    } else {
                        if (shadowRoot && shadowRoot.activeElement === lastFocusableEl) {
                            firstFocusableEl.focus()
                            e.preventDefault()
                        }
                    }
                    return
                }

                const target = e.composedPath()[0]

                if (target.id === 'dialog-confirm') {
                    confirm()
                }

                if (target.id === 'dialog-cancel') {
                    cancel()
                }
            }

            shadowRoot.addEventListener('click', eventHandler)
            shadowRoot.addEventListener('keyup', eventHandler)
            shadowRoot.addEventListener('keydown', eventHandler)
        })
    }

    createPrompt = (title: string, defaultValue = '', selectList = []) => {
        return this.createDialog('prompt', title, defaultValue, selectList)
    }

    createConfirm = (title: string) => {
        return this.createDialog('confirm', title)
    }

    createAlert = (message: string) => {
        return this.createDialog('alert', message)
    }

    connectedCallback() {
        if (this.shadowRoot === null) {
            return
        }

        this.shadowRoot.innerHTML = /* html */ `
        <div id="root"></div>
        <style>
        .dialog-container {
            position: fixed;
            height: 100vh;
            width: 100vw;
            display: grid;
            place-items: center;
            top: 0;
            left: 0;
            z-index: 9999;
            --border-radius: 3px;
        }

        .dialog {
            background-color: var(--modal-background-color);
            color: var(--modal-text-color);
            padding: 1rem;
            box-shadow: 1px 1px 42px -16px black;
            border-radius: 4px;
            border: 1px solid var(--modal-border-color);
            word-break: break-word;
        }

        .dialog-confirm, .dialog-alert {
            width: 20rem;
            padding: 1.5rem;
        }

        .dialog *::selection {
            background: #9cc3f5;
        }

        .dialog-primary-button, .dialog-secondary-button {
            padding: 8px 16px;
            border-radius: var(--border-radius);
            cursor: pointer;
        }

        .dialog-primary-button {
            background: var(--primary-background-color);
            color: var(--primary-text-color);
            border: none;
            width: 75px;
        }

        .dialog-primary-button:hover {
            background: var(--primary-hover-background-color);
        }

        .dialog-secondary-button {
            margin-left: 0.5rem;
            background: var(--button-background-color);
            color: var(--button-text-color);
            border: 1px solid var(--button-border-color);
        }

        .dialog-secondary-button:hover {
            background: var(--button-hover-background-color);
        }

        .dialog-input {
            padding: 7px;
            width: 25rem;
            border-radius: var(--border-radius);
            border: 1px solid var(--input-border-color);
            caret-color: var(--modal-caret-color);
            background-color: var(--modal-background-color);
            color: var(--text-color);
        }

        .color-preview {
            padding: 7px;
            height: 5rem;
            width: 5rem;
            caret-color: var(--modal-caret-color);
            background-color: var(--modal-background-color);
            color: var(--text-color);
            cursor: pointer;
        }

        .dialog-input::selection {
            background-color: var(--modal-input-selection-background-color);
        }

        .dialog-input:focus {
            outline: 1px solid var(--input-highlight-outline-color);
            border: 1px solid var(--input-highlight-outline-color);
            background-color: var(--modal-background-color);
            color: var(--text-color);
        }
        </style>
        `

        if (this.getAttribute('attach-to-window') === 'true') {
            window.createPrompt = this.createPrompt
            window.createConfirm = this.createConfirm
            window.createAlert = this.createAlert
        }
    }
}

customElements.define('alert-confirm-prompt', AlertConfirmPrompt)
