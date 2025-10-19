// Background service worker for PureWatch
console.log('PureWatch: Background service worker loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('PureWatch: Extension installed');
});
