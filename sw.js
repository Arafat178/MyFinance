const CACHE_NAME = 'my-finance-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// ১. Install Event: অ্যাপ ইনস্টল হওয়ার সময় ফাইলগুলো ক্যাশ করবে
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// ২. Fetch Event: নেটওয়ার্ক রিকোয়েস্ট হ্যান্ডেল করবে
self.addEventListener('fetch', event => {
  // Google Apps Script (API) রিকোয়েস্টগুলো ক্যাশ না করে সরাসরি নেটওয়ার্ক থেকে আনবে
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  // স্ট্যাটিক ফাইলগুলোর জন্য Cache First, Network Fallback স্ট্র্যাটেজি
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // ক্যাশে থাকলে সেখান থেকে লোড হবে
        }
        return fetch(event.request); // না থাকলে ইন্টারনেট থেকে লোড হবে
      })
  );
});

// ৩. Activate Event: পুরনো ক্যাশ ডিলিট করে নতুন আপডেট থাকলে সেটি নেবে
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});