// Default settings
const defaultSettings = {
  language: 'en-US',
  autoStart: false,
  showNotifications: true,
  notificationDuration: 3,
  contacts: []
};

// Save options to Chrome storage
function saveOptions() {
  const language = document.getElementById('language').value;
  const autoStart = document.getElementById('autoStart').checked;
  const showNotifications = document.getElementById('showNotifications').checked;
  const notificationDuration = document.getElementById('notificationDuration').value;
  
  // Get contacts from contact rows
  const contacts = [];
  const contactRows = document.querySelectorAll('.contact-row');
  
  contactRows.forEach(row => {
    const nameInput = row.querySelector('.contact-name');
    const emailInput = row.querySelector('.contact-email');
    
    // Only add if both fields have values
    if (nameInput.value.trim() && emailInput.value.trim()) {
      contacts.push({
        name: nameInput.value.trim(),
        email: emailInput.value.trim()
      });
    }
  });
  
  chrome.storage.sync.set({
    language,
    autoStart,
    showNotifications,
    notificationDuration,
    contacts
  }, () => {
    // Update status to let user know options were saved
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    status.className = 'status success';
    
    setTimeout(() => {
      status.textContent = '';
      status.className = 'status';
    }, 2000);
  });
}

// Restores options using the preferences stored in chrome.storage
function restoreOptions() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('language').value = items.language;
    document.getElementById('autoStart').checked = items.autoStart;
    document.getElementById('showNotifications').checked = items.showNotifications;
    document.getElementById('notificationDuration').value = items.notificationDuration;
    
    // Remove the initial empty contact row
    const contactsContainer = document.getElementById('contacts-container');
    contactsContainer.innerHTML = '';
    
    // Add contact rows for each saved contact
    if (items.contacts && items.contacts.length > 0) {
      items.contacts.forEach(contact => {
        addContactRow(contact.name, contact.email);
      });
    } else {
      // Add an empty row if no contacts
      addContactRow('', '');
    }
  });
}

// Add a new contact row
function addContactRow(name = '', email = '') {
  const contactsContainer = document.getElementById('contacts-container');
  const row = document.createElement('div');
  row.className = 'option-row contact-row';
  
  row.innerHTML = `
    <input type="text" placeholder="Contact name" class="contact-name" value="${name}">
    <input type="text" placeholder="Email address" class="contact-email" value="${email}">
    <button class="remove-contact">X</button>
  `;
  
  // Set up remove button click handler
  row.querySelector('.remove-contact').addEventListener('click', function() {
    row.remove();
  });
  
  contactsContainer.appendChild(row);
}

// Listen for clicks on the "Add Contact" button
document.getElementById('add-contact').addEventListener('click', () => {
  addContactRow();
});

// Listen for clicks on the "Save" button
document.getElementById('save').addEventListener('click', saveOptions);

// Load saved options when page loads
document.addEventListener('DOMContentLoaded', restoreOptions); 