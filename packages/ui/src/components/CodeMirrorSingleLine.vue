<template>
    <div class="code-mirror-single-line" :class="{ disabled }"></div>
</template>

<script lang="ts">
import { EditorView, keymap, placeholder, drawSelection } from '@codemirror/view'
import { EditorState, StateEffect } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { closeBrackets, autocompletion, completeFromList } from '@codemirror/autocomplete'
import { envVarDecoration } from '@/utils/codemirror-extensions'
import { tags } from '@/codemirror-extensions/tags'
import { json } from '@codemirror/lang-json'
import { codeMirrorSyntaxHighlighting, getEditorConfig, getSpaces } from '@/helpers'
import { indentOnInput, indentUnit, bracketMatching, syntaxHighlighting } from '@codemirror/language'
import type { ParsedResult } from '@/parsers/tag'

function getExtensions(vueInstance) {
    const singleLineEnforcers = []
    const multiLineEnforcers = []

    if(!vueInstance.allowMultipleLines) {
        // From: https://discuss.codemirror.net/t/codemirror-6-single-line-and-or-avoid-carriage-return/2979/2
        [
            EditorState.transactionFilter.of(tr => tr.newDoc.lines > 1 ? [] : tr),
            EditorView.domEventHandlers({
                paste: async(event, view) => {
                    const content = event.clipboardData.getData('text/plain')

                    // if pasteHandler exists & pasteHandler returns true, it means it handled the paste event
                    if(vueInstance.pasteHandler && await vueInstance.pasteHandler(content)) {
                        console.log('pasteHandler returned true, so not handling paste event')
                        return
                    }

                    console.log('pasteHandler not defined or returned false, so handling paste event')

                    if(content.includes('\n')) {
                        const contentWithoutNewLines = content.replace(/[\n\r]/g, '')
                        const transaction = view.state.replaceSelection(contentWithoutNewLines)
                        const update = view.state.update(transaction)
                        view.update([update])
                    } else {
                        const transaction = view.state.replaceSelection(content)
                        const update = view.state.update(transaction)
                        view.update([update])
                    }

                    return true
                },
            }),
        ].forEach(enforcer => singleLineEnforcers.push(enforcer))
    } else {
        [
            EditorView.lineWrapping,
        ].forEach(enforcer => multiLineEnforcers.push(enforcer))
    }

    let autocompletions: any[] = []

    if(vueInstance.autocompletions.length > 0) {
        autocompletions = [
            completeFromList(vueInstance.autocompletions)
        ]
    }

    const tagClickHandler = (parsedFunc: ParsedResult, updateFunc: (updatedTag: string) => void) => {
        vueInstance.$emit('tag-click', parsedFunc, updateFunc)
    }

    const languageExtensions = []

    if (vueInstance.lang === 'json') {
        languageExtensions.push(json())
        const highlightStyle = codeMirrorSyntaxHighlighting()
        languageExtensions.push(syntaxHighlighting(highlightStyle, { fallback: true }))
        languageExtensions.push(indentOnInput())
        languageExtensions.push(indentUnit.of(getSpaces(getEditorConfig().indentSize)))
        languageExtensions.push(bracketMatching())
        languageExtensions.push(closeBrackets()) // auto close flower brackets, close double quotes
    }

    const extensions = [
        ...languageExtensions,
        history(),
        EditorView.updateListener.of(v => {
            if(v.docChanged) {
                vueInstance.emitted = true
                vueInstance.$emit('update:modelValue', v.state.doc.toString())
            }
        }),
        ...singleLineEnforcers,
        ...multiLineEnforcers,
        keymap.of([
            ...defaultKeymap.filter(key => vueInstance.allowMultipleLines || key.key !== 'Enter'),
            ...historyKeymap
        ]),
        placeholder(vueInstance.placeholder),
        envVarDecoration(vueInstance.envVariables),
        tags(tagClickHandler),
        drawSelection(),
        autocompletion({
            override: [
                ...autocompletions,
                context => {
                    let word = context.matchBefore(/\w*/)
                    if(!word) {
                        return null
                    }
                    if(word.from == word.to && !context.explicit) {
                        return null
                    }
                    return {
                        from: word.from,
                        options: vueInstance.getSuggestions(word.text).map(suggestion => ({
                            label: suggestion.label,
                            type: suggestion.type,
                            apply: (view, completion, from, to) => {
                                const text = view.state.doc.toString()

                                // get 3 characters before from or all characters before from if from < 3
                                const before = text.slice(from - (from < 3 ? from : 3), from)
                                // get 3 characters after to or all characters after to if to + 3 exceeds text length
                                const after = text.slice(to, to + 3)

                                let completionText = completion.label

                                const condition1 = before.endsWith('{{')
                                const condition2 = before.endsWith('{{ ')
                                const condition3 = after.startsWith('}}')
                                const condition4 = after.startsWith(' }}')

                                if(condition1) {
                                    completionText = completionText + '}}'
                                }

                                if(condition2) {
                                    completionText = completionText + ' }}'
                                }

                                if(!condition1 && !condition2) {
                                    completionText = '{{' + completionText + '}}'
                                }

                                if(condition3) {
                                    completionText = completionText.slice(0, -2)
                                }

                                if(condition4) {
                                    completionText = completionText.slice(0, -3)
                                }

                                view.dispatch({
                                    changes: { from, to, insert: completionText }
                                })
                            }
                        })),
                        validFor: /^\w*$/
                    }
                }
            ]
        })
    ]

    if(vueInstance.disabled) {
        extensions.push(EditorView.editable.of(false))
    }

    return extensions
}

function createState(vueInstance) {
    return EditorState.create({
        doc: typeof vueInstance.modelValue === 'string' ? vueInstance.modelValue : '',
        extensions: getExtensions(vueInstance)
    })
}

export default {
    props: {
        modelValue: {
            type: String,
            default: ''
        },
        placeholder: {
            type: String,
            default: ''
        },
        envVariables: {
            type: Object,
            default: () => ({})
        },
        inputTextCompatible: {
            type: Boolean,
            default: false
        },
        allowMultipleLines: {
            type: Boolean,
            default: false
        },
        pasteHandler: {
            type: Function,
            default: null
        },
        disabled: {
            type: Boolean,
            default: false
        },
        autocompletions: {
            type: Array,
            default: () => []
        },
        lang: {
            type: String,
            required: false,
        },
    },
    data() {
        return {
            emitted: false,
            query: '',
            filteredSuggestions: [],
            showSuggestions: false
        }
    },
    editor: null,
    methods: {
        getSuggestions(word) {
            const allSuggestions = Object.keys(this.envVariables)
            return allSuggestions.filter((suggestion) =>
                suggestion.toLowerCase().startsWith(word.toLowerCase())
            ).map(suggestion => ({ label: suggestion, type: 'variable' }))
        }
    },
    watch: {
        modelValue() {
            if(!this.emitted) {
                this.editor.setState(createState(this))
            } else {
                this.emitted = false
            }
        },
        envVariables: {
            deep: true,
            handler() {
                if (this.editor) {
                    this.editor.dispatch({
                        effects: StateEffect.reconfigure.of(getExtensions(this))
                    })
                }
            }
        },
        disabled() {
            if (this.editor) {
                this.editor.dispatch({
                    effects: StateEffect.reconfigure.of(getExtensions(this))
                })
            }
        },
    },
    mounted() {
        this.editor = new EditorView({
            state: createState(this),
            parent: this.$el
        })
    }
}
</script>

<style>
.code-mirror-single-line .cm-editor {
    height: 100%;
}

.code-mirror-single-line .cm-editor.cm-focused {
    outline: 0 !important;
}

.code-mirror-single-line .cm-scroller {
    font-family: inherit !important;
    margin-left: v-bind('inputTextCompatible ? "2px" : "0.2rem"');
    margin-right: v-bind('inputTextCompatible ? "2px" : "0.5rem"');
    overflow: v-bind('allowMultipleLines ? "visible" : "hidden"');
    line-height: v-bind('inputTextCompatible ? "1.3" : "1.4"');
}

.code-mirror-single-line .cm-content {
    padding: v-bind('inputTextCompatible ? "0" : "4px 0"');
}

.code-mirror-single-line .cm-line {
    padding: v-bind('inputTextCompatible ? "0" : "0 2px 0 4px"');
}

.code-mirror-single-line .cm-content[contenteditable="false"] {
    background-color: var(--input-disabled-background-color);
    color: var(--input-disabled-color);
}

.modal .code-mirror-single-line .cm-content[contenteditable="false"] {
    background-color: var(--modal-input-disabled-background-color);
    color: var(--modal-input-disabled-color);
}

/* when editor transitions from empty to filled when you type something, the editor messes */
/* with the size of the div container, causing a small layout shift - this fixes that */
/* img.cm-widgetBuffers seems appear inside editor only when the editor is empty */
/* without this fix, the ui jump can be seen in the socket panel address bar & the */
/* request panel inputs of the auth tab, when moving from empty to filled */
.code-mirror-single-line .cm-widgetBuffer {
    vertical-align: inherit;
}

.cm-tooltip-autocomplete ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.cm-tooltip-autocomplete li {
    padding: 8px 12px;
    background-color: var(--background-color);
    cursor: pointer;
}

.cm-tooltip-autocomplete li:hover,
.cm-tooltip-autocomplete li.cm-completion-selected {
    background-color: var(--default-border-color-modal);
}
</style>
