const { contextBridge, ipcRenderer } = require('electron')

const ipcFunctions = [
    'sendRequest',
    'cancelRequest',
    'updateWorkspace',
    'getCollectionForWorkspace',
    'getCollectionById',
    'createCollection',
    'createCollections',
    'updateCollection',
    'deleteCollectionsByWorkspaceId',
    'deleteCollectionsByIds',
    'getResponsesByCollectionId',
    'createResponse',
    'updateResponse',
    'deleteResponse',
    'deleteResponsesByIds',
    'deleteResponsesByCollectionIds',
    'deleteResponsesByCollectionId',
    'getWorkspacePlugins',
    'createPlugin',
    'updatePlugin',
    'deletePlugin',
    'deletePluginsByWorkspace',
    'deletePluginsByCollectionIds',
    'createPlugins',
    'openFolderSelectionDialog',
]

const electronIPC = ipcFunctions.reduce((acc, funcName) => {
    acc[funcName] = (...args) => ipcRenderer.invoke(funcName, ...args)
    return acc
}, {})

contextBridge.exposeInMainWorld('electronIPC', electronIPC)
