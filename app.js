function toBengaliNumber(engNumber) {
  if (engNumber === null || engNumber === undefined) return '';
  const engStr = String(engNumber);
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let bengaliStr = '';
  for (let i = 0; i < engStr.length; i++) {
    const char = engStr[i];
    if (char >= '0' && char <= '9') {
      bengaliStr += bengaliDigits[parseInt(char)];
    } else {
      bengaliStr += char;
    }
  }
  return bengaliStr;
}

function saveDb() {
  const DATABASE_KEY = 'abidNetworkDb_v41';
  localStorage.setItem(DATABASE_KEY, JSON.stringify(db));
}

// Global variable to track which bill the payment modal is opened for
let currentPaymentBillId = null;

// Global database variable
let db = {
  customers: [],
  bills: [],
  ispPayments: [],
  routers: [],
  locations: []
};
// Global database variable
// নতুন ভেরিয়েবল শুরু
let displayedActivitiesCount = 0;
const ACTIVITIES_PER_PAGE = 10; // প্রতিবার ১০টি করে লোড হবে
// নতুন ভেরিয়েবল শেষ

/**
 * পেমেন্টের হিসাব রাখে এবং ডেটাবেস আপডেট করে।
 * @param {string} billId - বিলের আইডি।
 * @param {number} receivedAmount - প্রাপ্ত টাকার পরিমাণ।
 */
// এই নতুন ফাংশনটি logPayment ফাংশনের ঠিক উপরে বসবে

document.addEventListener('DOMContentLoaded', () => {
  setupMacInput('customerMacContainer');
  setupMacInput('routerMacContainer');
  updateLastExportDate();
  let customerToEditId = null;
  const DATABASE_KEY = 'abidNetworkDb_v41'; // Version updated to 4.1
  const LAST_PAGE_KEY = 'abidNetworkLastPage';

  const defaultLocations = [
    'বাড়ি১ঃ মেইন রাউটার', 'বাড়ি২ঃ বোরহানের বাসা', 'বাড়ি৩ঃ টিনশেড',
    'বাড়ি৪ঃ পিছনের বাসা', 'বাড়ি৫ঃ গোলাপের বাসা'
  ];
  const defaultBillAmounts = [150, 170, 'other'];
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর',
    'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const years = Array.from({
    length: 10
  }, (_, i) => new Date().getFullYear() - 5 + i);

  // Load data from localStorage and update global db
  const localDb = JSON.parse(localStorage.getItem(DATABASE_KEY)) || {
    customers: [],
    bills: [],
    ispPayments: [],
    routers: [],
    locations: defaultLocations.slice()
  };

  // Update global db with loaded data
  db.customers = localDb.customers;
  db.bills = localDb.bills;
  db.ispPayments = localDb.ispPayments;
  db.routers = localDb.routers;
  db.locations = localDb.locations;

  function toBengaliNumber(engNumber) {
    if (engNumber === null || engNumber === undefined) return '';
    const engStr = String(engNumber);
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let bengaliStr = '';
    for (let i = 0; i < engStr.length; i++) {
      const char = engStr[i];
      if (char >= '0' && char <= '9') {
        bengaliStr += bengaliDigits[parseInt(char)];
      } else {
        bengaliStr += char;
      }
    }
    return bengaliStr;
  }

  function migrateDb(data) {
    // This function can be expanded for future migrations
    if (!data.routers) data.routers = [];
    if (!data.locations || data.locations.length === 0) {
      data.locations = [...defaultLocations];
    }

    if (data.customers) {
      data.customers.forEach(c => {
        if (c.macAddress && Array.isArray(c.macAddress)) {
          c.macAddress = c.macAddress.join(':');
        }
        if (c.advanceBalance === undefined) {
          c.advanceBalance = 0;
        }
      });
    }

    if (data.bills) {
      data.bills.forEach(b => {
        // যদি পুরনো ব্যাকআপ হয় এবং এই তথ্যগুলো না থাকে
        if (b.status === undefined) {
          b.status = b.isPaid ? 'paid' : 'unpaid';
        }
        if (b.paidAmount === undefined) {
          b.paidAmount = b.isPaid ? b.totalAmount : 0;
        }
        if (b.remainingDue === undefined) {
          b.remainingDue = b.isPaid ? 0 : b.totalAmount;
        }
        if (b.paymentHistory === undefined) {
          b.paymentHistory = [];
        }
        if (b.adjustments === undefined) {
          b.adjustments = [];
        }
        if (b.advanceUsed === undefined) {
          b.advanceUsed = 0;
        }
      });
    }

    return data;
  }

  // Activity Management System
  const ACTIVITY_STORAGE_KEY = 'abidNetworkActivities_v1';
  const MAX_ACTIVITIES = 50;

  // Activity types and their configurations
  const ACTIVITY_TYPES = {
    'customer_added': {
      title: 'নতুন গ্রাহক যোগ',
      icon: '👤',
      className: 'customer-added'
    },
    'customer_deleted': {
      title: 'গ্রাহক মুছে ফেলা',
      icon: '🗑️',
      className: 'customer-deleted'
    },
    'bill_created': {
      title: 'বিল তৈরি',
      icon: '📄',
      className: 'bill-created'
    },
    'bill_deleted': {
      title: 'বিল মুছে ফেলা',
      icon: '🗑️',
      className: 'bill-deleted'
    },
    'bill_paid': {
      title: 'বিল পরিশোধ',
      icon: '💰',
      className: 'bill-paid'
    },
    'bill_status_paid': {
      title: 'বিল পরিশোধিত',
      icon: '✅',
      className: 'bill-paid'
    },
    'payment_history': {
      title: 'আংশিক পেমেন্ট',
      icon: '💳',
      className: 'payment-history'
    },
    'isp_payment': {
      title: 'আইএসপি বিল পরিশোধ',
      icon: '🌐',
      className: 'isp-payment'
    },
    'isp_payment_deleted': {
      title: 'আইএসপি বিল মুছে ফেলা',
      icon: '🗑️',
      className: 'isp-payment-deleted'
    },
    'router_added': {
      title: 'রাউটার যোগ',
      icon: '📡',
      className: 'router-added'
    },
    'router_deleted': {
      title: 'রাউটার মুছে ফেলা',
      icon: '🗑️',
      className: 'router-deleted'
    },
    'advance_deposit': {
      title: 'অ্যাডভান্স জমা',
      icon: '💳',
      className: 'advance-deposit'
    },
    'due_adjustment': {
      title: 'বকেয়া সমন্বয়',
      icon: '⚠️',
      className: 'due-adjustment'
    },
    'adjustment_updated': {
      title: 'সমন্বয় আপডেট',
      icon: '✏️',
      className: 'due-adjustment'
    },
    'adjustment_deleted': {
      title: 'অ্যাডজাস্টমেন্ট মুছে ফেলা',
      icon: '🗑️',
      className: 'adjustment-deleted'
    },
    'data_import': {
      title: 'ডাটা ইমপোর্ট',
      icon: '📥',
      className: 'data-import'
    },
    'data_backup': {
      title: 'ডাটা ব্যাকআপ',
      icon: '💾',
      className: 'data-backup'
    },
    'location_added': {
      title: 'বাড়ি যোগ',
      icon: '🏠',
      className: 'location-added'
    },
    'location_deleted': {
      title: 'বাড়ি মুছে ফেলা',
      icon: '🗑️',
      className: 'location-deleted'
    },
    'month_bills_deleted': {
      title: 'মাসিক সব বিল মুছে ফেলা',
      icon: '🗑️',
      className: 'month-bills-deleted'
    },
    'all_isp_history_deleted': {
      title: 'সব আইএসপি বিল ইতিহাস মুছে ফেলা',
      icon: '🗑️',
      className: 'all-isp-history-deleted'
    },
    'discount_applied': { 
      title: 'বিশেষ ছাড়',    
      icon: '🏷️',
      className: 'due-adjustment'
    },
    'report_generated': {
      title: 'রিপোর্ট তৈরি',
      icon: '🖨️',
      className: 'report-generated'
    }
  };

  // Load activities from localStorage
  function loadActivities() {
    try {
      const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading activities:', error);
      return [];
    }
  }

  // Save activities to localStorage
  function saveActivities(activities) {
    try {
      // Keep only the latest MAX_ACTIVITIES
      const trimmedActivities = activities.slice(0, MAX_ACTIVITIES);
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmedActivities));
    } catch (error) {
      console.error('Error saving activities:', error);
    }
  }

  // Add new activity
  function addActivity(type, description, metadata = {}) {
    const activities = loadActivities();
    const activity = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: type,
      title: ACTIVITY_TYPES[type]?.title || 'অজানা কার্যক্রম',
      description: description,
      timestamp: new Date().toISOString(),
      metadata: metadata
    };

    activities.unshift(activity); // Add to beginning
    saveActivities(activities);

    // Update dashboard if currently visible
    if (document.getElementById('dashboard').classList.contains('active')) {
      renderRecentActivities();
    }
  }

  // Format time for display
  function formatActivityTime(timestamp) {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'এখনই';
    if (diffInMinutes < 60) return `${toBengaliNumber(diffInMinutes)} মিনিট আগে`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${toBengaliNumber(diffInHours)} ঘন্টা আগে`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${toBengaliNumber(diffInDays)} দিন আগে`;

    // For older activities, show date
    const options = {
      day: 'numeric',
      month: 'long'
    };
    return activityTime.toLocaleDateString('bn-BD', options);
  }

  // Render recent activities

  function renderRecentActivities(loadMore = false) {
    const clearLogBtn = document.getElementById('clear-activity-log-btn');
    const allActivities = loadActivities();
    const container = document.getElementById('recent-activities');
    const noActivitiesDiv = document.getElementById('no-activities');
    const loaderDiv = document.getElementById('activity-loader');
    const loadMoreBtn = document.getElementById('load-more-activities-btn');

    if (!container) return;

    if (!loadMore) {
      // যদি প্রথমবার লোড হয়, কন্টেইনার খালি করুন এবং কাউন্টার রিসেট করুন
      container.innerHTML = '';
      displayedActivitiesCount = 0;
    }

    if (allActivities.length === 0) {
      container.style.display = 'none';
      noActivitiesDiv.style.display = 'block';
      loaderDiv.style.display = 'none';
      if (clearLogBtn) clearLogBtn.style.display = 'none'; // <-- এই লাইনটি যোগ করুন
      return;
    }

    // যদি লগ থাকে, তবে বাটনটি দেখানো হবে
    if (clearLogBtn) clearLogBtn.style.display = 'inline-flex';

    container.style.display = 'grid';
    noActivitiesDiv.style.display = 'none';

    const startIndex = displayedActivitiesCount;
    const endIndex = startIndex + ACTIVITIES_PER_PAGE;
    const activitiesToRender = allActivities.slice(startIndex, endIndex);

    let newActivitiesHtml = activitiesToRender.map(activity => {
      const config = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES['data_backup'];
      const timeStr = formatActivityTime(activity.timestamp);

      let metadataHtml = '';
      if (activity.metadata) {
        const tags = [];
        if (activity.metadata.customerName) tags.push(activity.metadata.customerName);
        if (activity.metadata.amount) tags.push(`৳${toBengaliNumber(activity.metadata.amount)}`);
        if (activity.metadata.location) tags.push(activity.metadata.location);
        if (activity.metadata.month !== undefined && activity.metadata.year !== undefined) {
          const monthName = months[activity.metadata.month];
          tags.push(`${monthName} ${toBengaliNumber(activity.metadata.year)}`);
        }

        if (tags.length > 0) {
          metadataHtml = `<div class="activity-metadata">${tags.map(tag =>
                `<span class="activity-tag">${tag}</span>`
            ).join('')}</div>`;
        }
      }

      return `
        <div class="activity-card ${config.className}">
            <div class="activity-header">
                <div class="activity-icon">${config.icon}</div>
                <h3 class="activity-title">${config.title}</h3>
                <span class="activity-time">${timeStr}</span>
            </div>
            <p class="activity-description">${activity.description}</p>
            ${metadataHtml}
        </div>
    `;
    }).join('');

    container.insertAdjacentHTML('beforeend', newActivitiesHtml);
    displayedActivitiesCount += activitiesToRender.length;

    // "আরো দেখুন" বাটনের অবস্থা নিয়ন্ত্রণ
    if (displayedActivitiesCount < allActivities.length) {
      loaderDiv.style.display = 'block';
    } else {
      loaderDiv.style.display = 'none';
    }
  }

  function saveDb() {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(db));
  }

  function loadDb() {
    const data = localStorage.getItem(DATABASE_KEY);
    if (data) {
      const parsedData = JSON.parse(data);
      db = migrateDb(parsedData);
    } else {
      // Check for older db versions for migration
      const oldDataV40 = localStorage.getItem('abidNetworkDb_v40');
      if (oldDataV40) {
        console.log("Migrating data from v4.0 to v4.1");
        const parsedOldData = JSON.parse(oldDataV40);
        db = migrateDb(parsedOldData);
      } else {
        db.locations = [...defaultLocations];
      }
    }
    saveDb();
  }

  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const overlay = document.getElementById('overlay');
  const pageTitle = document.getElementById('page-title');

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.style.display = 'none';
  });

  function switchPage(pageId, isInitialLoad = false) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');

    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === pageId) {
        item.classList.add('active');
        let titleText = item.querySelector('span').textContent;
        if (pageId === 'advance') titleText = 'রাউটার ম্যানেজমেন্ট';
        pageTitle.textContent = titleText;
      }
    });

    if (!isInitialLoad) localStorage.setItem(LAST_PAGE_KEY, pageId);

    sidebar.classList.remove('active');
    overlay.style.display = 'none';

    if (pageId === 'add_customer') {
      initializeCustomerForm();

      if (customerToEditId) {
        const customer = db.customers.find(c => c.id === customerToEditId);
        if (customer) {
          customerIdInput.value = customer.id;
          customerNameInput.value = customer.name;
          customerPhoneInput.value = customer.phone;
          customerHouseInput.value = customer.house;

          if (defaultBillAmounts.includes(customer.monthlyBill)) {
            customerBillInput.value = customer.monthlyBill;
          } else {
            customerBillInput.value = 'other';
            customBillAmountInput.value = customer.monthlyBill;
          }

          connectionDateInput.value = customer.connectionDate;
          isFreeUserInput.checked = customer.isFree;

          customerFormTitle.textContent = 'গ্রাহকের তথ্য আপডেট করুন';
          customerSubmitBtn.textContent = 'আপডেট করুন';
          customerCancelBtn.style.display = 'inline-block';

          customerBillInput.dispatchEvent(new Event('change'));
          isFreeUserInput.dispatchEvent(new Event('change'));
          setMacAddress('customerMacContainer', customer.macAddress);
        }
        customerToEditId = null;
      }
    }

    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'customers') renderCustomerListPage();
    if (pageId === 'billing') renderBillingPage();
    if (pageId === 'isp_bill') renderIspBillPage();
    if (pageId === 'reports') renderReportPage();
    if (pageId === 'advance') renderAdvancePage();
    if (pageId === 'settings') renderSettingsPage();
    if (pageId === 'about') renderAboutPage();
  }

  // About page functions
  function renderAboutPage() {
    // About page is static HTML, no dynamic rendering needed
    // Initialize user guide functionality
    initializeAboutPage();
  }

  function initializeAboutPage() {
    const userGuideBtn = document.getElementById('user-guide-btn');
    const userGuideContainer = document.getElementById('user-guide-container');

    if (userGuideBtn && userGuideContainer) {
      // Remove any existing event listeners to prevent duplicates
      userGuideBtn.replaceWith(userGuideBtn.cloneNode(true));
      const newUserGuideBtn = document.getElementById('user-guide-btn');

      newUserGuideBtn.addEventListener('click', function() {
        if (userGuideContainer.style.display === 'none' || userGuideContainer.style.display === '') {
          userGuideContainer.style.display = 'block';
          newUserGuideBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        গাইড লুকান
                    `;
        } else {
          userGuideContainer.style.display = 'none';
          newUserGuideBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                        সম্পূর্ণ গাইড দেখুন
                    `;
        }
      });
    }
  }

  window.toggleGuideSection = function(sectionId) {
    const content = document.getElementById(sectionId);
    if (!content) return;

    const header = content.previousElementSibling;
    const icon = header ? header.querySelector('.expand-icon') : null;

    if (content.classList.contains('expanded')) {
      content.classList.remove('expanded');
      if (header) header.classList.remove('expanded');
      if (icon) icon.textContent = '▼';
    } else {
      content.classList.add('expanded');
      if (header) header.classList.add('expanded');
      if (icon) icon.textContent = '▲';
    }
  }

  function renderAdvancePage() {
    const routerListContainer = document.getElementById('router-list');
    const routerModal = document.getElementById('routerModal');
    const modalCloseBtn = document.getElementById('routerModalCloseBtn');
    const routerForm = document.getElementById('routerForm');
    const toggleFormBtn = document.getElementById('toggleRouterFormBtn');
    const formContainer = document.getElementById('routerFormContainer');

    function saveAndRenderRouters() {
      saveDb();
      renderRouters();
    }

    function renderRouters() {
      routerListContainer.innerHTML = '';
      const filteredRouters = db.routers;

      if (filteredRouters.length === 0) {
        routerListContainer.innerHTML =
          '<p style="text-align:center; color:#718096;">কোনো রাউটার পাওয়া যায়নি।</p>';
        return;
      }
      filteredRouters.forEach(router => {
        const customerCount = db.customers.filter(c => c.house === router.location).length;
        const item = document.createElement('div');
        item.className = 'router-item';
        item.innerHTML = `
                    <div class="router-item-content" data-router-id="${router.id}">
                        <img src="https://i.ibb.co/Lz0dGqC/router-icon.png" alt="Router Icon">
                        <div class="router-info">
                            <div class="name">${router.name}</div>
                            <div class="model">${router.model}</div>
                            <div class="customer-count">গ্রাহক: ${toBengaliNumber(customerCount)} জন</div>
                        </div>
                    </div>
                    <button class="router-delete-btn" data-router-id="${router.id}">&times;</button>
                `;
        routerListContainer.appendChild(item);
      });
    }

    // Add feet to meters conversion
    document.getElementById('routerDistanceFeet').addEventListener('input', function() {
      const feet = parseFloat(this.value) || 0;
      const meters = (feet * 0.3048).toFixed(2);
      document.getElementById('routerDistanceMeters').value = meters;
    });

    populateDropdown('routerLocationSelect', db.locations, {
      isBengali: false
    });
    toggleFormBtn.onclick = () => {
      formContainer.classList.toggle('active');
      toggleFormBtn.textContent = formContainer.classList.contains('active') ? 'ফর্ম লুকান' :
        'নতুন রাউটার যোগ করুন';
    };

    // ★★★ নতুন এবং উন্নত কোড (সফলতার বার্তা সহ) ★★★
    routerForm.onsubmit = (e) => {
      e.preventDefault();
      const imageFile = document.getElementById('routerImage').files[0];
      let imageDataUrl = null;

      const processRouter = () => {
        const routerId = document.getElementById('routerId').value;
        const routerData = {
          name: document.getElementById('routerName').value,
          model: document.getElementById('routerModel').value,
          ip: document.getElementById('routerIp').value,
          macAddress: getMacAddress('routerMacContainer'),
          distanceFeet: parseFloat(document.getElementById('routerDistanceFeet').value) || 0,
          distanceMeters: parseFloat(document.getElementById('routerDistanceMeters').value) || 0,
          powerSpec: document.getElementById('routerPowerSpec').value,
          password: document.getElementById('routerPassword').value,
          location: document.getElementById('routerLocationSelect').value,
          image: imageDataUrl
        };

        if (routerId) {
          // রাউটার আপডেট করা হচ্ছে
          const routerIndex = db.routers.findIndex(r => r.id == routerId);
          if (routerIndex > -1) {
            db.routers[routerIndex] = {
              ...db.routers[routerIndex],
              ...routerData
            };
            // ★★★ সফলতার বার্তা যোগ করা হয়েছে ★★★
            alert(`রাউটার "${routerData.name}"-এর তথ্য সফলভাবে আপডেট করা হয়েছে।`);
          }
        } else {
          // নতুন রাউটার যোগ করা হচ্ছে
          const newRouter = {
            id: Date.now(),
            ...routerData
          };
          db.routers.push(newRouter);

          addActivity('router_added', `${routerData.name} নামে নতুন রাউটার যোগ করা হয়েছে`, {
            routerName: routerData.name,
            location: routerData.location,
            model: routerData.model,
            ip: routerData.ip
          });
          // ★★★ সফলতার বার্তা যোগ করা হয়েছে ★★★
          alert(`নতুন রাউটার "${routerData.name}" সফলভাবে যোগ করা হয়েছে।`);
        }

        saveAndRenderRouters();
        routerForm.reset();
        document.getElementById('routerId').value = '';
        formContainer.classList.remove('active');
        toggleFormBtn.textContent = 'নতুন রাউটার যোগ করুন';
      };

      if (imageFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imageDataUrl = e.target.result;
          processRouter();
        };
        reader.readAsDataURL(imageFile);
      } else {
        const routerId = document.getElementById('routerId').value;
        if (routerId) {
          const existingRouter = db.routers.find(r => r.id == routerId);
          if (existingRouter) {
            imageDataUrl = existingRouter.image;
          }
        }
        processRouter();
      }
    };

    // ★★★ নতুন এবং নিরাপদ কোড (সতর্কবার্তা সহ) ★★★
    routerListContainer.onclick = (e) => {
      // রাউটার মুছে ফেলার বাটন
      if (e.target.classList.contains('router-delete-btn')) {
        const routerId = e.target.dataset.routerId;
        const router = db.routers.find(r => r.id == routerId);
        if (!router) return;

        // ★★★ সতর্কবার্তা যোগ করা হয়েছে ★★★
        if (confirm(`আপনি কি নিশ্চিতভাবে "${router.name}" রাউটারটি মুছে ফেলতে চান?`)) {
          const routerName = router.name;

          db.routers = db.routers.filter(r => r.id != routerId);

          addActivity('router_deleted', `রাউটার মুছে ফেলা হয়েছে: ${routerName}`, {
            routerName: routerName,
            routerId: routerId
          });

          saveAndRenderRouters();
          alert(`রাউটার "${routerName}" সফলভাবে মুছে ফেলা হয়েছে।`);
        }
      }
      // রাউটারের বিস্তারিত দেখার জন্য ক্লিক
      else if (e.target.closest('.router-item-content')) {
        const routerId = e.target.closest('.router-item-content').dataset.routerId;
        const routerData = db.routers.find(r => r.id == routerId);
        if (routerData) {
          // ... (এই অংশটি আগের মতোই থাকবে, কোনো পরিবর্তন নেই)
          document.getElementById('modal-title').textContent = routerData.name;
          document.getElementById('modal-model').textContent = routerData.model;
          document.getElementById('modal-location').textContent = routerData.location;
          document.getElementById('modal-distance').textContent = routerData.distanceMeters || routerData
            .distance || 'N/A';
          document.getElementById('modal-ip').textContent = routerData.ip;
          document.getElementById('modal-mac-address').textContent = routerData.macAddress || 'N/A';
          document.getElementById('modal-power-spec').textContent = routerData.powerSpec || 'N/A';
          document.getElementById('modal-password').textContent = routerData.password || 'N/A';
          document.getElementById('modal-access-link').href = `http://${routerData.ip}`;

          const imageContainer = document.getElementById('modal-router-image-container');
          imageContainer.style.display = 'none';

          const editBtn = document.getElementById('modal-edit-router-btn');
          editBtn.onclick = () => {
            routerModal.classList.remove('active');
            document.getElementById('routerId').value = routerData.id;
            document.getElementById('routerName').value = routerData.name;
            document.getElementById('routerModel').value = routerData.model;
            document.getElementById('routerIp').value = routerData.ip;
            document.getElementById('routerDistanceFeet').value = routerData.distanceFeet || '';
            document.getElementById('routerDistanceMeters').value = routerData.distanceMeters || '';
            document.getElementById('routerPowerSpec').value = routerData.powerSpec || '';
            document.getElementById('routerPassword').value = routerData.password || '';
            document.getElementById('routerLocationSelect').value = routerData.location;
            setMacAddress('routerMacContainer', routerData.macAddress || '');
            formContainer.classList.add('active');
            toggleFormBtn.textContent = 'ফর্ম লুকান';
            formContainer.scrollIntoView({
              behavior: 'smooth'
            });
          };

          routerModal.classList.add('active');
        }
      }
    };

    modalCloseBtn.onclick = () => routerModal.classList.remove('active');
    routerModal.onclick = (e) => {
      if (e.target === routerModal) routerModal.classList.remove('active');
    };

    renderRouters();
  }

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage(item.dataset.page);
    });
  });

  function populateDropdown(elementId, options, config = {}) {
    const {
      defaultValue,
      isBengali = true
    } = config;
    const select = document.getElementById(elementId);
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '';
    options.forEach(opt => {
      const option = document.createElement('option');
      if (typeof opt === 'object' && opt.value !== undefined) {
        option.value = opt.value;
        option.textContent = opt.text;
      } else {
        option.value = opt;
        if (opt === 'other') {
          option.textContent = 'অন্যান্য...';
        } else {
          option.textContent = isBengali ? toBengaliNumber(opt) : opt;
        }
      }
      select.appendChild(option);
    });
    if (defaultValue !== undefined) {
      select.value = defaultValue;
    } else if (currentValue) {
      select.value = currentValue;
    }
  }
    // ★★★ নতুন বিল রিমাইন্ডার ফাংশন (renderDashboard এর আগে যোগ করুন) ★★★

  function checkAndDisplayBillReminder() {
    const notificationCard = document.getElementById('bill-reminder-notification');
    const contentWrapper = document.getElementById('bill-reminder-content-wrapper');
    const viewDueBtn = document.getElementById('view-due-bills-btn');

    if (!notificationCard || !contentWrapper || !viewDueBtn) return;

    const today = new Date();
    const REMINDER_DELAY_DAYS = 10;

    const allDueBills = db.bills.filter(bill =>
      bill.status === 'unpaid' || bill.status === 'partially_paid'
    );

    const overdueBills = allDueBills.filter(bill => {
      if (!bill.createdAt) {
        // পুরনো বিল, যেগুলোতে createdAt তারিখ নেই, সেগুলোর জন্য পুরনো নিয়ম প্রযোজ্য হবে
        return today.getDate() >= REMINDER_DELAY_DAYS;
      }

      const billCreationDate = new Date(bill.createdAt);
      const diffTime = Math.abs(today - billCreationDate);
      const billAgeInDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return billAgeInDays >= REMINDER_DELAY_DAYS;
    });

    if (overdueBills.length > 0) {
      const totalOverdueAmount = overdueBills.reduce((sum, bill) => sum + bill.remainingDue, 0);

      contentWrapper.innerHTML = `
        <h4 style="margin: 0 0 3px 0; color: #C53030; font-size: 13px; font-weight: 600;">বিল পরিশোধ রিমাইন্ডার</h4>
        <p style="margin: 0; color: #7B341E; font-size: 11px; line-height: 1.3;">
            <strong>${toBengaliNumber(overdueBills.length)} জন</strong> গ্রাহকের বিল নির্ধারিত সময়ের মধ্যে পরিশোধ করা হয়নি।
            মোট বকেয়া: <strong>৳${toBengaliNumber(totalOverdueAmount.toFixed(2))}</strong>
        </p>
    `;

      viewDueBtn.onclick = () => {
        switchPage('billing');
        setTimeout(() => {
          const unpaidFilterBtn = document.querySelector('#billing .filter-btn[data-filter="unpaid"]');
          if (unpaidFilterBtn) unpaidFilterBtn.click();
        }, 100);
      };

      notificationCard.style.display = 'block';
    } else {
      notificationCard.style.display = 'none';
    }
  }

  function renderDashboard() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthBills = db.bills.filter(b => b.month == currentMonth && b.year == currentYear);

    const totalCustomers = db.customers.filter(c => c.isActive !== false).length;
    const totalBillAmount = monthBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    const totalPaid = monthBills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);
    const totalUnpaid = totalBillAmount - totalPaid;

    document.getElementById('db-total-customers').textContent = toBengaliNumber(totalCustomers);
    document.getElementById('db-total-bill').textContent = `৳${toBengaliNumber(totalBillAmount.toFixed(2))}`;
    document.getElementById('db-total-paid').textContent = `৳${toBengaliNumber(totalPaid.toFixed(2))}`;
    document.getElementById('db-total-unpaid').textContent = `৳${toBengaliNumber(totalUnpaid.toFixed(2))}`;

    renderRecentActivities();
    checkAndDisplayBillReminder();
  }
  const customerForm = document.getElementById('customerForm');
  const customerIdInput = document.getElementById('customerId');
  const customerNameInput = document.getElementById('customerName');
  const customerPhoneInput = document.getElementById('customerPhone');
  const customerHouseInput = document.getElementById('customerHouse');
  const customerBillInput = document.getElementById('customerBill');
  const customBillGroup = document.getElementById('customBillGroup');
  const customBillAmountInput = document.getElementById('customBillAmount');
  const connectionDateInput = document.getElementById('connectionDate');
  const isFreeUserInput = document.getElementById('isFreeUser');
  const customerFormTitle = document.getElementById('customer-form-title');
  const customerSubmitBtn = document.getElementById('customer-submit-btn');
  const customerCancelBtn = document.getElementById('customer-cancel-btn');

  function initializeCustomerForm() {
    populateDropdown('customerHouse', db.locations, {
      isBengali: false
    });
    populateDropdown('customerBill', defaultBillAmounts);
    if (!customerIdInput.value) {
      connectionDateInput.valueAsDate = new Date();
    }
  }

  customerBillInput.addEventListener('change', () => {
    customBillGroup.classList.toggle('hidden', customerBillInput.value !== 'other');
  });

  function resetCustomerForm() {
    customerForm.reset();
    customerIdInput.value = '';
    customerFormTitle.textContent = 'নতুন গ্রাহক যোগ করুন';
    customerSubmitBtn.textContent = 'গ্রাহক যোগ করুন';
    connectionDateInput.valueAsDate = new Date();
    customBillGroup.classList.add('hidden');
    customerCancelBtn.style.display = 'none';
  }

  isFreeUserInput.addEventListener('change', () => {
    const billGroup = document.getElementById('customerBill').parentElement;
    billGroup.classList.toggle('hidden', isFreeUserInput.checked);
    if (isFreeUserInput.checked) {
      customerBillInput.required = false;
      customBillGroup.classList.add('hidden');
    } else {
      customerBillInput.required = true;
      customBillGroup.classList.toggle('hidden', customerBillInput.value !== 'other');
    }
  });

  customerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const customerId = document.getElementById('customerId').value;
    const customerName = document.getElementById('customerName').value.trim();
    const isFree = document.getElementById('isFreeUser').checked;

    // Check for duplicate name (only for new customers)
    if (!customerId) {
      const existingCustomer = db.customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
      if (existingCustomer) {
        alert('এই নামে ইতিমধ্যে একজন গ্রাহক রয়েছে। দয়া করে অন্য নাম ব্যবহার করুন।');
        return;
      }
    }

    let monthlyBill = 0;
    if (!isFree) {
      const billSelect = document.getElementById('customerBill');
      monthlyBill = billSelect.value === 'other' ?
        parseFloat(document.getElementById('customBillAmount').value) :
        parseFloat(billSelect.value);
    }
    const macAddress = getMacAddress('customerMacContainer');

    const customerData = {
      id: customerId || Date.now().toString(),
      name: customerName,
      phone: document.getElementById('customerPhone').value,
      house: document.getElementById('customerHouse').value,
      monthlyBill,
      connectionDate: document.getElementById('connectionDate').value,
      isFree,
      macAddress,
      advanceBalance: 0,
      deactivationPending: false
    };

    if (customerId) {
      const index = db.customers.findIndex(c => c.id === customerId);
      customerData.advanceBalance = db.customers[index].advanceBalance;
      db.customers[index] = customerData;
      alert('গ্রাহকের তথ্য সফলভাবে আপডেট করা হয়েছে।');
      showBackupReminder();
    } else {
      db.customers.push(customerData);
      alert('নতুন গ্রাহক সফলভাবে যোগ করা হয়েছে।');

      // Add activity log for new customer
      addActivity('customer_added', `${customerName} নামে নতুন গ্রাহক যোগ করা হয়েছে`, {
        customerName: customerName,
        location: customerData.house,
        amount: monthlyBill,
        isFree: isFree
      });

      showBackupReminder();
    }
    saveDb();
    resetCustomerForm();
    switchPage('customers');
  });

  customerCancelBtn.addEventListener('click', () => {
    resetCustomerForm();
    switchPage('customers');
  });

  function getCustomerStatus(customer) { 
    if (!customer) return {
      text: 'Unknown',
      class: '',
      sortOrder: 99
    };

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const currentBill = db.bills.find(b =>
      b.customerId === customer.id && 
      b.year === currentYear &&
      b.month === currentMonth
    );

    if (customer.isFree) {
      return {
        text: 'ফ্রি',
        class: 'status-free',
        sortOrder: 4
      };
    }

    if (currentBill) {
      if (currentBill.status === 'paid') {
        if (customer.advanceBalance > 0) {
          return {
            text: `অ্যাডভান্স: ৳${toBengaliNumber(customer.advanceBalance.toFixed(2))}`,
            class: 'status-advance',
            sortOrder: 3
          };
        }
        return {
          text: 'Paid',
          class: 'status-paid',
          sortOrder: 5
        };
      }

      if (currentBill.status === 'partially_paid') {
        return {
          text: `বকেয়া: ৳${toBengaliNumber(currentBill.remainingDue.toFixed(2))}`,
          class: 'status-unpaid',
          sortOrder: 2
        };
      }

      return {
        text: `বকেয়া: ৳${toBengaliNumber(currentBill.remainingDue.toFixed(2))}`,
        class: 'status-unpaid',
        sortOrder: 1
      };

    } else {
      if (customer.advanceBalance > 0) {
        return {
          text: `অ্যাডভান্স: ৳${toBengaliNumber(customer.advanceBalance.toFixed(2))}`,
          class: 'status-advance',
          sortOrder: 3
        };
      }

      return {
        text: 'Pending',
        class: 'status-pending',
        sortOrder: 6
      };
    }
  }

  function renderCustomerListPage(searchTerm = '', filter = 'all') {
    const container = document.getElementById('customer-list-by-house');
    container.innerHTML = '';

    let customersToDisplay = db.customers;
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      customersToDisplay = customersToDisplay.filter(c =>
        c.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (c.phone && c.phone.includes(searchTerm))
      );
    }

    document.getElementById('total-customer-count').textContent = toBengaliNumber(customersToDisplay.length);

    if (customersToDisplay.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; color:#718096; margin-top: 20px;">কোনো গ্রাহক পাওয়া যায়নি।</p>';
      return;
    }

    const houseGroups = {};
    customersToDisplay.forEach(customer => {
      if (!houseGroups[customer.house]) {
        houseGroups[customer.house] = [];
      }
      houseGroups[customer.house].push(customer);
    });

    const sortedHouses = Object.keys(houseGroups).sort((a, b) => db.locations.indexOf(a) - db.locations.indexOf(
      b));

    sortedHouses.forEach(house => {
      let houseCustomers = houseGroups[house];
      if (houseCustomers.length === 0) return;

      houseCustomers = houseCustomers.map(customer => ({
          ...customer,
          statusInfo: getCustomerStatus(customer)
        }))
        .sort((a, b) => a.statusInfo.sortOrder - b.statusInfo.sortOrder);

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        `<h2>${house} (${toBengaliNumber(houseCustomers.length)} জন)</h2><div class="table-container"><table class="data-table"><thead><tr><th>নাম</th><th>মাসিক বিল</th><th>স্ট্যাটাস</th><th>একশন</th></tr></thead><tbody></tbody></table></div>`;
      const tableBody = card.querySelector('tbody');

      houseCustomers.forEach(customer => {
        const row = document.createElement('tr');
        
        let actionButtons;
        if (customer.isActive === false) {
          row.style.backgroundColor = '#FFF1F2';
          row.style.color = '#881337';
          actionButtons =
            `<button class="btn action-btn" style="background-color: #28a745;" onclick="reactivateCustomer('${customer.id}')">সক্রিয় করুন</button>`;
        } else {
          actionButtons = `
                <button class="btn action-btn" style="background-color: #3182CE;" onclick="editCustomer('${customer.id}')">Edit</button>
                <button class="btn btn-delete action-btn" onclick="deleteCustomer('${customer.id}')">Del</button>
            `;
        }

        row.innerHTML = `
            <td><a href="#" class="customer-name-link" onclick="openCustomerProfile('${customer.id}')">${customer.name}</a></td>
            <td>৳${toBengaliNumber(customer.monthlyBill.toFixed(2))}</td>
            <td class="${customer.statusInfo.class}">${customer.statusInfo.text}</td>
            <td>${actionButtons}</td>
        `;
        tableBody.appendChild(row);
      });
      container.appendChild(card);
    });
    const lastScrollPosition = sessionStorage.getItem('lastScrollPosition');
    if (lastScrollPosition) {
        setTimeout(() => {
            window.scrollTo(0, parseInt(lastScrollPosition, 10));
            sessionStorage.removeItem('lastScrollPosition');
        }, 100);
    }
  }

  document.getElementById('customer-search-input').addEventListener('input', (e) => renderCustomerListPage(e
    .target.value));

  window.editCustomer = (id) => {
      sessionStorage.setItem('lastScrollPosition', window.scrollY);
      
      customerToEditId = id;
      switchPage('add_customer');
  };

  window.deleteCustomer = (id) => {
    if (confirm('আপনি কি নিশ্চিতভাবে এই গ্রাহককে মুছে ফেলতে চান? এই গ্রাহকের সকল বিলের তথ্যও মুছে যাবে।')) {
      const customer = db.customers.find(c => c.id === id);
      const customerName = customer ? customer.name : 'অজানা গ্রাহক';

      db.customers = db.customers.filter(c => c.id !== id);
      db.bills = db.bills.filter(b => b.customerId !== id);

      addActivity('customer_deleted', `গ্রাহক মুছে ফেলা হয়েছে: ${customerName}`, {
        customerName: customerName,
        customerId: id
      });

      saveDb();
      renderCustomerListPage(document.getElementById('customer-search-input').value);
      renderDashboard();
    }
  };
  const generateBillsBtn = document.getElementById('generateBillsBtn');
  const deleteMonthBillsBtn = document.getElementById('delete-month-bills-btn');
  const billingListContainer = document.getElementById('billing-list-by-house');

  const adjustmentModal = document.getElementById('adjustmentModal');
  const adjustmentModalClose = document.getElementById('adjustment-modal-close');
  const adjustmentForm = document.getElementById('adjustmentForm');
  const adjustmentList = document.getElementById('adjustment-list');
  const adjustmentFormTitle = document.getElementById('adjustment-form-title');
  const adjustmentSubmitBtn = document.getElementById('adjustment-submit-btn');
  const adjustmentCancelBtn = document.getElementById('adjustment-cancel-btn');

  const ispEditModal = document.getElementById('ispEditModal');
  const ispEditModalClose = document.getElementById('isp-edit-modal-close');
  const ispEditForm = document.getElementById('ispEditForm');

  function initializeBillingForm() {
    const monthOptions = months.map((m, i) => ({
      value: i,
      text: m
    }));
    populateDropdown('generateYear', years, {
      defaultValue: new Date().getFullYear()
    });
    populateDropdown('generateMonth', monthOptions, {
      defaultValue: new Date().getMonth()
    });

    const customerOptions = [{
      value: 'all',
      text: 'সকল গ্রাহক'
    }].concat(
      db.customers.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({
        value: c.id,
        text: `${c.name} (${c.house.split('ঃ')[0]})`
      }))
    );
    populateDropdown('generateForCustomer', customerOptions, {
      defaultValue: 'all'
    });
  }

  function renderBillingPage() {
    initializeBillingForm();
    const year = document.getElementById('generateYear').value;
    const month = document.getElementById('generateMonth').value;
    const searchTerm = document.getElementById('billing-search-input').value;

    renderBillingTable(year, month, searchTerm, 'all');

    document.querySelectorAll('.payment-action-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const billId = event.target.getAttribute('data-bill-id');
        openPaymentModal(billId);
      });
    });
  }

  function renderBillingTable(year, month, searchTerm = '', filter = 'all') {
    billingListContainer.innerHTML = '';
    let monthBills = db.bills.filter(b => b.year == year && b.month == month);

    if (searchTerm) {
      monthBills = monthBills.filter(bill => {
        const customer = db.customers.find(c => c.id === bill.customerId);
        return customer && customer.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (filter === 'unpaid') {
      monthBills = monthBills.filter(b => b.status !== 'paid');
    }
    const statusPriority = {
      'unpaid': 1,
      'partially_paid': 2,
      'paid': 3
    };
    monthBills.sort((a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99));

    db.locations.forEach(house => {
      const houseBills = monthBills.filter(bill => {
        const customer = db.customers.find(c => c.id === bill.customerId);
        return customer && customer.house === house;
      });

      if (houseBills.length === 0) return;

      const unpaidCount = houseBills.filter(b => b.status !== 'paid').length;
      const unpaidText = unpaidCount > 0 ?
        `<span class="unpaid-count">(${toBengaliNumber(unpaidCount)} জন বিল দেয়নি)</span>` : '';

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        `<h2>${house} ${unpaidText}</h2><div class="table-container"><table class="data-table"><thead><tr><th>গ্রাহক</th><th>মাসিক বিল</th><th>বকেয়া</th><th>এডভ্যান্স</th><th>মোট বিল</th><th>স্ট্যাটাস</th><th>একশন</th></tr></thead><tbody></tbody></table></div>`;
      const tableBody = card.querySelector('tbody');

      houseBills.forEach(bill => {
        const customer = db.customers.find(c => c.id === bill.customerId);
        if (!customer) return;

        const dueFromAdjustments = (bill.adjustments || []).filter(a => a.type === 'due').reduce((sum,
          a) => sum + a.amount, 0);
        const finalTotalAmount = bill.monthlyAmount + bill.dueAmount + dueFromAdjustments;

        let dueForDisplay = 0; 
        let statusText, statusClass;

        if (bill.status === 'paid') {
          statusText = 'Paid';
          statusClass = 'status-paid';
          dueForDisplay = 0; 
        } else if (bill.status === 'partially_paid') {
          statusText = 'Partially Paid';
          statusClass = 'status-partially-paid';
          dueForDisplay = bill.remainingDue; 
        } else { // Unpaid
          statusText = 'Unpaid';
          statusClass = 'status-unpaid';
          dueForDisplay = bill.dueAmount +
          dueFromAdjustments; 
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="#" class="customer-name-link" onclick="openCustomerProfile('${customer.id}')">${customer.name}</a></td>
            <td>৳${toBengaliNumber(bill.monthlyAmount.toFixed(2))}</td>
            <td>৳${toBengaliNumber(dueForDisplay.toFixed(2))}</td>
            <td>৳${toBengaliNumber((customer.advanceBalance || 0).toFixed(2))}</td>
            <td><strong>৳${toBengaliNumber(finalTotalAmount.toFixed(2))}</strong></td>
            <td class="${statusClass}">${statusText}</td>
            <td>
                <button class="btn btn-submit action-btn payment-action-btn" data-bill-id="${bill.id}">পেমেন্ট</button>
                <button class="btn btn-submit action-btn" onclick="openAdjustmentModal('${bill.id}')">Adj</button>
                <button class="btn btn-delete action-btn" onclick="deleteBill('${bill.id}')">Del</button>
            </td>
        `;
        tableBody.appendChild(row);
      });
      billingListContainer.appendChild(card);
    });

    document.querySelectorAll('.payment-action-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const billId = event.target.getAttribute('data-bill-id');
        openPaymentModal(billId);
      });
    });
  }

  function createBillForCustomer(customer, year, month) {
    if (customer.isFree) return;

    const previousMonth = month === 0 ? 11 : month - 1;
    const yearForPrevious = month === 0 ? year - 1 : year;

    const lastBill = db.bills.find(b => b.customerId === customer.id && b.year == yearForPrevious && b.month ==
      previousMonth);

    let dueFromPrevious = 0;
    if (lastBill && lastBill.status !== 'paid') {
      dueFromPrevious = lastBill.remainingDue || 0;
    }

    let monthlyAmount = customer.monthlyBill;
    let totalAmount = monthlyAmount + dueFromPrevious;
    let status = 'unpaid';
    let advanceUsed = 0;
    let paidAmount = 0;
    let remainingDue = totalAmount;
    let paymentHistoryForBill = []; 

    if (customer.advanceBalance > 0) {
      const amountToUseFromAdvance = Math.min(customer.advanceBalance, totalAmount);

      advanceUsed = amountToUseFromAdvance;
      customer.advanceBalance -= amountToUseFromAdvance;
      paidAmount = amountToUseFromAdvance;
      remainingDue = totalAmount - amountToUseFromAdvance;

      paymentHistoryForBill.push({
        id: Date.now() + Math.random(),
        amount: amountToUseFromAdvance,
        date: new Date().toISOString(),
        source: 'advance', 
        balanceAfter: remainingDue
      });

      status = remainingDue <= 0 ? 'paid' : 'partially_paid';
    }

    db.bills.push({
      id: Date.now().toString() + customer.id,
      customerId: customer.id,
      year: parseInt(year),
      month: parseInt(month),
      createdAt: new Date().toISOString(),
      monthlyAmount: monthlyAmount,
      dueAmount: dueFromPrevious,
      totalAmount: totalAmount,
      status: status,
      paidAmount: paidAmount,
      remainingDue: remainingDue,
      adjustments: [],
      advanceUsed: advanceUsed,
      isPaid: status === 'paid',
      paymentHistory: paymentHistoryForBill,
      discount: 0
    });
  }

  generateBillsBtn.addEventListener('click', () => {
    const year = parseInt(document.getElementById('generateYear').value);
    const month = parseInt(document.getElementById('generateMonth').value);
    const customerId = document.getElementById('generateForCustomer').value;

    if (db.customers.length === 0) {
      alert('এই মুহূর্তে সিস্টেমে কোন গ্রাহক নেই তাই বিল তৈরি করা যাচ্ছে না');
      return;
    }

    if (customerId === 'all') {
      const existingBilledCustomerIds = new Set(db.bills.filter(b => b.year === year && b.month === month)
        .map(b => b.customerId));

      const customersToBill = db.customers.filter(customer => {
        const isActive = customer.isActive === undefined ? true : customer.isActive;
        if (!isActive || customer.isFree || existingBilledCustomerIds.has(customer.id)) {
          return false;
        }
        const connectionDate = new Date(customer.connectionDate);
        const today = new Date();
        const diffTime = Math.abs(today - connectionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 30;
      });

      if (customersToBill.length === 0) {
        alert(
          'এই মুহূর্তে বিল তৈরির জন্য যোগ্য কোনো গ্রাহক পাওয়া যায়নি। (যাদের সংযোগের বয়স ৩০ দিনের বেশি এবং বিল তৈরি হয়নি)'
          );
        return;
      }

      customersToBill.forEach(customer => createBillForCustomer(customer, year, month));
      alert(
        `${toBengaliNumber(customersToBill.length)} জন যোগ্য গ্রাহকের জন্য বিল সফলভাবে তৈরি করা হয়েছে।`);

      addActivity('bill_created',
        `${toBengaliNumber(customersToBill.length)} জন গ্রাহকের জন্য বিল তৈরি করা হয়েছে`, {
          month: month,
          year: year,
          customerCount: customersToBill.length
        });
      showBackupReminder();

    } else {
      const customer = db.customers.find(c => c.id === customerId);
      if (customer) {
        const isActive = customer.isActive === undefined ? true : customer.isActive;
        if (!isActive) {
          alert(
            `${customer.name}-এর সংযোগটি নিষ্ক্রিয় আছে। নিষ্ক্রিয় গ্রাহকের জন্য বিল তৈরি করা যাবে না।`);
          return;
        }

        const connectionDate = new Date(customer.connectionDate);
        const today = new Date();
        const diffTime = Math.abs(today - connectionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          if (diffDays < 25) {
            alert(`বিল তৈরি করা সম্ভব নয়। ${customer.name}-এর সংযোগের বয়স এখনো ২৫ দিন পূর্ণ হয়নি।`);
            return;
          }

          const proceed = confirm(
            `সতর্কবার্তা: ${customer.name}-এর সংযোগের বয়স এখনো ৩০ দিন পূর্ণ হয়নি (বর্তমান বয়স ${toBengaliNumber(diffDays)} দিন)। \n\nআপনি কি तरी বিলটি তৈরি করতে চান?`
            );
          if (!proceed) {
            return;
          }
        }

        const existingBillIndex = db.bills.findIndex(b => b.customerId === customer.id && b.year === year &&
          b.month === month);
        if (existingBillIndex > -1) {
          if (!confirm(
              `${customer.name}-এর বিল এই মাসের জন্য ইতিমধ্যে তৈরি করা আছে। আপনি কি এটি মুছে আবার তৈরি করতে চান?`
              )) return;
          db.bills.splice(existingBillIndex, 1);
        }
        createBillForCustomer(customer, year, month);
        alert(`${customer.name}-এর জন্য বিল সফলভাবে তৈরি করা হয়েছে।`);

        addActivity('bill_created', `${customer.name}-এর জন্য বিল তৈরি করা হয়েছে`, {
          customerName: customer.name,
          month: month,
          year: year,
          amount: customer.monthlyBill
        });
        showBackupReminder();
      }
    }

    saveDb();
    renderBillingPage();
  });

  deleteMonthBillsBtn.addEventListener('click', () => {
    const year = parseInt(document.getElementById('generateYear').value);
    const month = parseInt(document.getElementById('generateMonth').value);
    const monthName = months[month];
    if (confirm(
        `সতর্কতা! আপনি কি নিশ্চিতভাবে ${monthName}, ${toBengaliNumber(year)}-এর সকল বিল মুছে ফেলতে চান? এই কাজটি ফেরানো যাবে না।`
        )) {
      const deletedBills = db.bills.filter(b => b.year === year && b.month === month);
      const deletedCount = deletedBills.length;

      db.bills = db.bills.filter(b => b.year !== year || b.month !== month);

      addActivity('month_bills_deleted',
        `মাসিক সব বিল মুছে ফেলা হয়েছে: ${monthName} ${year} (${deletedCount} টি বিল)`, {
          month: month,
          year: year,
          deletedCount: deletedCount
        });

      saveDb();
      alert(`${monthName}, ${toBengaliNumber(year)}-এর সকল বিল সফলভাবে মুছে ফেলা হয়েছে।`);
      renderBillingPage();
      renderDashboard();
    }
  });

  window.toggleBillStatus = (billId) => {
    const bill = db.bills.find(b => b.id === billId);
    if (bill) {
      bill.isPaid = !bill.isPaid;
      saveDb();
      renderBillingPage();
      renderDashboard();
    }
  };

  function renderAdjustments(billId) {
    const bill = db.bills.find(b => b.id === billId);
    adjustmentList.innerHTML = '';
    if (!bill || !bill.adjustments || bill.adjustments.length === 0) {
      adjustmentList.innerHTML = '<li>কোনো অ্যাডজাস্টমেন্ট পাওয়া যায়নি।</li>';
      return;
    }
    bill.adjustments.forEach(adj => {
      const li = document.createElement('li');
      const typeText = adj.type === 'due' ? 'বকেয়া' : 'অ্যাডভান্স';
      li.innerHTML = `
                <span class="adjustment-info">${typeText}: ৳${toBengaliNumber(adj.amount)} (${adj.notes || 'N/A'})</span>
                <div class="adjustment-actions">
                    <button class="btn action-btn" style="background-color: #3182CE;" onclick="editAdjustment('${bill.id}', '${adj.id}')">Edit</button>
                    <button class="btn btn-delete action-btn" onclick="deleteAdjustment('${bill.id}', '${adj.id}')">Del</button>
                </div>
            `;
      adjustmentList.appendChild(li);
    });
  }

  window.openAdjustmentModal = (billId) => {
    const bill = db.bills.find(b => b.id === billId);
    const customer = db.customers.find(c => c.id === bill.customerId);
    if (bill && customer) {
      document.getElementById('adjustmentBillId').value = bill.id;
      document.getElementById('modal-customer-name-adj').textContent = customer.name;
      renderAdjustments(bill.id);
      resetAdjustmentForm();
      adjustmentModal.classList.add('active');
      overlay.style.display = 'block';
    }
  };

  function closeAdjustmentModal() {
    adjustmentModal.classList.remove('active');
    overlay.style.display = 'none';
  }
  adjustmentModalClose.addEventListener('click', closeAdjustmentModal);

  function resetAdjustmentForm() {
    adjustmentForm.reset();
    document.getElementById('adjustmentId').value = '';
    adjustmentFormTitle.textContent = 'নতুন অ্যাডজাস্টমেন্ট যোগ করুন';
    adjustmentSubmitBtn.textContent = 'সংরক্ষণ করুন';
    adjustmentCancelBtn.style.display = 'none';
  }
  adjustmentCancelBtn.addEventListener('click', resetAdjustmentForm);

  window.editAdjustment = (billId, adjId) => {
    const bill = db.bills.find(b => b.id === billId);
    const adj = bill.adjustments.find(a => a.id === adjId);
    if (adj) {
      document.getElementById('adjustmentId').value = adj.id;
      document.getElementById('adjustmentAmount').value = adj.amount;
      document.getElementById('adjustmentType').value = adj.type;
      document.getElementById('adjustmentNotes').value = adj.notes;
      adjustmentFormTitle.textContent = 'অ্যাডজাস্টমেন্ট এডিট করুন';
      adjustmentSubmitBtn.textContent = 'আপডেট করুন';
      adjustmentCancelBtn.style.display = 'inline-block';
    }
  };

  window.deleteAdjustment = (billId, adjId) => {
    if (confirm('আপনি কি নিশ্চিতভাবে এই অ্যাডজাস্টমেন্টটি মুছে ফেলতে চান?')) {
      const bill = db.bills.find(b => b.id === billId);
      const adj = bill.adjustments.find(a => a.id === adjId);
      const customer = db.customers.find(c => c.id === bill.customerId);

      if (adj.type === 'advance') {
        customer.advanceBalance -= adj.amount;
      }

      bill.adjustments = bill.adjustments.filter(a => a.id !== adjId);

      const typeText = adj.type === 'due' ? 'বকেয়া' : 'অ্যাডভান্স';
      addActivity('adjustment_deleted',
        `অ্যাডজাস্টমেন্ট মুছে ফেলা হয়েছে: ${customer.name} - ${typeText} ৳${adj.amount}`, {
          customerName: customer.name,
          adjustmentType: adj.type,
          amount: adj.amount,
          notes: adj.notes
        });

      recalculateBillTotal(billId);
      saveDb();
      renderAdjustments(billId);
      renderBillingPage();
    }
  };

  adjustmentForm.addEventListener('submit', e => {
    e.preventDefault();
    const billId = document.getElementById('adjustmentBillId').value;
    const adjId = document.getElementById('adjustmentId').value;
    const amount = parseFloat(document.getElementById('adjustmentAmount').value);
    const type = document.getElementById('adjustmentType').value;
    const notes = document.getElementById('adjustmentNotes').value;
    const bill = db.bills.find(b => b.id === billId);
    const customer = db.customers.find(c => c.id === bill.customerId);

    if (!bill || !customer || isNaN(amount) || amount <= 0) {
      alert("অনুগ্রহ করে সঠিক তথ্য দিন।");
      return;
    }

    if (adjId) {
      const adjIndex = bill.adjustments.findIndex(a => a.id === adjId);
      if (adjIndex > -1) {
        const oldAdj = bill.adjustments[adjIndex];
        if (oldAdj.type === 'advance') {
          customer.advanceBalance -= oldAdj.amount;
        }
        bill.adjustments[adjIndex] = {
          ...oldAdj,
          amount,
          type,
          notes
        };
      }
    } else {
      if (!bill.adjustments) {
        bill.adjustments = [];
      }
      bill.adjustments.push({
        id: Date.now().toString() + Math.random(),
        amount,
        type,
        notes
      });
    }

    if (type === 'advance') {
      customer.advanceBalance = (customer.advanceBalance || 0) + amount;
      addActivity('advance_deposit', `${customer.name}-এর অ্যাকাউন্টে অ্যাডভান্স জমা হয়েছে`, {
        customerName: customer.name,
        amount: amount,
        notes: notes
      });
    } else {
      addActivity('due_adjustment', `${customer.name}-এর বকেয়া সমন্বয় করা হয়েছে`, {
        customerName: customer.name,
        amount: amount,
        notes: notes
      });
    }

    recalculateBillTotal(billId);
    saveDb();
    renderAdjustments(billId);
    renderBillingPage();
    renderCustomerListPage();
    resetAdjustmentForm();
    alert("সমন্বয় সফলভাবে সম্পন্ন হয়েছে!");
  });

  document.querySelectorAll('.note-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.getElementById('adjustmentNotes').value = tag.dataset.note;
    });
  });

  window.deleteBill = (billId) => {
    if (confirm('আপনি কি নিশ্চিতভাবে এই বিলটি মুছে ফেলতে চান?')) {
      const billIndex = db.bills.findIndex(b => b.id === billId);
      if (billIndex > -1) {
        const bill = db.bills[billIndex];
        const customer = db.customers.find(c => c.id === bill.customerId);
        const customerName = customer ? customer.name : 'অজানা গ্রাহক';
        const monthName = months[bill.month];

        db.bills.splice(billIndex, 1);

        addActivity('bill_deleted', `বিল মুছে ফেলা হয়েছে: ${customerName} (${monthName} ${bill.year})`, {
          customerName: customerName,
          month: bill.month,
          year: bill.year,
          amount: bill.totalAmount
        });

        saveDb();
        renderBillingPage();
        renderDashboard();
      }
    }
  };

  function openPaymentModal(billId) {
    const bill = db.bills.find(b => b.id === billId);
    if (!bill) {
      alert('ত্রুটি: বিল খুঁজে পাওয়া যায়নি!');
      return;
    }

    const customer = db.customers.find(c => c.id === bill.customerId);
    if (!customer) {
      alert('ত্রুটি: গ্রাহক খুঁজে পাওয়া যায়নি!');
      return;
    }

    currentPaymentBillId = billId;

    const totalBill = bill.totalAmount || 0;
    const discount = bill.discount || 0;
    const paidAmount = bill.paidAmount || 0;
    const finalBill = totalBill - discount;
    const dueAmount = Math.max(0, finalBill - paidAmount);
    const advanceAmount = customer.advanceBalance || 0;

    document.getElementById('payment-customer-name').textContent = customer.name;
    document.getElementById('payment-bill-month').textContent =
      `${months[bill.month]}, ${toBengaliNumber(bill.year)}`;
    document.getElementById('payment-bill-amount').textContent =
      `৳${toBengaliNumber(finalBill.toFixed(2))} (ছাড়: ৳${toBengaliNumber(discount.toFixed(2))})`;
    document.getElementById('payment-due-amount').textContent = `৳${toBengaliNumber(dueAmount.toFixed(2))}`;
    document.getElementById('payment-advance-amount').textContent =
      `৳${toBengaliNumber(advanceAmount.toFixed(2))}`;
    document.getElementById('payment-amount-input').value = '';
    document.getElementById('discount-amount-input').value = '';

    displayPaymentHistory(billId);

    document.getElementById('paymentModal').classList.add('active');
    document.getElementById('overlay').style.display = 'block';

    setTimeout(() => {
      document.getElementById('payment-amount-input').focus();
    }, 300);
  }

  function closePaymentModal() {
    const paymentModal = document.getElementById('paymentModal');
    const overlay = document.getElementById('overlay');

    if (paymentModal) {
      paymentModal.classList.remove('active');
    }
    if (overlay) {
      overlay.style.display = 'none';
    }

    currentPaymentBillId = null; 

    const discountContent = document.getElementById('discount-section-content');
    const toggleDiscountBtn = document.getElementById('toggle-discount-section-btn');
    const discountInput = document.getElementById('discount-amount-input');

    if (discountContent) {
      discountContent.classList.remove('active'); 
    }
    if (toggleDiscountBtn) {
      toggleDiscountBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle; margin-right: 5px;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        বিশেষ ছাড় দিন
    `;
    }
    if (discountInput) {
      discountInput.value = '';
    }
  }

  function displayPaymentHistory(billId) {
    const bill = db.bills.find(b => b.id === billId);
    const historyContainer = document.getElementById('payment-history-list');

    if (!bill || !bill.paymentHistory || !bill.paymentHistory.length) {
      historyContainer.innerHTML = '<div class="payment-history-empty">কোনো পেমেন্ট ইতিহাস পাওয়া যায়নি</div>';
      return;
    }

    const styles = `
    .payment-history-item-final-v3 { background: #F7FAFC; border: 1px solid #E2E8F0; border-left: 4px solid var(--secondary-color); border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; }
    .ph-source-final-v3 { font-size: 11px; font-weight: 600; color: var(--primary-color); margin-bottom: 3px; display: flex; align-items: center; gap: 5px; }
    .ph-amount-final-v3 { font-size: 18px; font-weight: 700; color: var(--paid-color); margin-bottom: 4px; }
    .ph-date-final-v3 { font-size: 10px; color: #718096; display: flex; align-items: center; gap: 5px; }
    .ph-status-line-final-v3 { margin-top: 5px; font-size: 11px; display: flex; flex-direction: column; gap: 4px; }
    .ph-status-line-final-v3 .due { font-style: italic; color: #718096; }
    .ph-status-line-final-v3 .final-payment { font-weight: 600; color: var(--paid-color); }
    .ph-status-line-final-v3 .new-advance, .ph-status-line-final-v3 .total-advance { font-weight: 600; color: var(--advance-color); }
`;
    if (!document.getElementById('payment-history-styles-final-v3')) {
      const styleSheet = document.createElement("style");
      styleSheet.id = 'payment-history-styles-final-v3';
      styleSheet.innerText = styles;
      document.head.appendChild(styleSheet);
    }

    const sortedHistory = bill.paymentHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    let historyHTML = sortedHistory.map(payment => {
      const paymentDate = new Date(payment.date);
      const formattedDate = paymentDate.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let sourceText;
      if (payment.source === 'manual') sourceText = '👤 ম্যানুয়াল পেমেন্ট';
      else if (payment.source === 'advance') sourceText = '💳 অ্যাডভান্স থেকে সমন্বয়';
      else if (payment.source === 'advance_deposit') sourceText = '✨ সরাসরি অ্যাডভান্স জমা';
      else sourceText = 'অজানা উৎস';

      let statusLinesHTML = '';

      if (payment.isFinalPayment) {
        statusLinesHTML +=
          `<div class="final-payment">✅ বিলটি এই পেমেন্টের মাধ্যমে সম্পূর্ণ পরিশোধিত হয়েছে।</div>`;
        if (payment.newAdvance > 0) {
          statusLinesHTML +=
            `<div class="new-advance">✨ এবং ৳${toBengaliNumber(payment.newAdvance.toFixed(2))} নতুন অ্যাডভান্স হিসেবে জমা হয়েছে।</div>`;
        }
      } else if (payment.source === 'advance_deposit') {
        const totalAdvance = Math.abs(payment.balanceAfter);
        if (payment.isFirstAdvance) {
          statusLinesHTML +=
            `<div class="new-advance">✨ নতুন অ্যাডভান্স জমা হয়েছে: ৳${toBengaliNumber(totalAdvance.toFixed(2))}</div>`;
        } else {
          statusLinesHTML +=
            `<div class="total-advance">📈 মোট অ্যাডভান্স এখন: ৳${toBengaliNumber(totalAdvance.toFixed(2))}</div>`;
        }
      } else if (payment.balanceAfter > 0) {
        statusLinesHTML +=
          `<div class="due">📉 পেমেন্টের পর বকেয়া: ৳${toBengaliNumber(payment.balanceAfter.toFixed(2))}</div>`;
      }

      return `
        <div class="payment-history-item-final-v3">
            <div class="ph-source-final-v3">${sourceText}</div>
            <div class="ph-amount-final-v3">৳${toBengaliNumber(payment.amount.toFixed(2))}</div>
            <div class="ph-date-final-v3">🗓️ ${formattedDate}</div>
            <div class="ph-status-line-final-v3">${statusLinesHTML}</div>
        </div>
    `;
    }).join('');

    historyContainer.innerHTML = historyHTML;
  }

  document.getElementById('generateYear').addEventListener('change', renderBillingPage);
  document.getElementById('generateMonth').addEventListener('change', renderBillingPage);
  document.getElementById('billing-search-input').addEventListener('input', renderBillingPage);
  document.querySelectorAll('#billing .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('#billing .filter-btn.active').classList.remove('active');
      btn.classList.add('active');
      renderBillingPage();
    });
  });

  const ispBillForm = document.getElementById('ispBillForm');
  const ispHistoryTableBody = document.querySelector('#ispHistoryTable tbody');

  function initializeIspForm() {
    const monthOptions = months.map((m, i) => ({
      value: i,
      text: m
    }));
    populateDropdown('ispYear', years, {
      defaultValue: new Date().getFullYear()
    });
    populateDropdown('ispMonth', monthOptions, {
      defaultValue: new Date().getMonth()
    });
    document.getElementById('ispPayDate').valueAsDate = new Date();
  }

  function renderIspHistoryTable() {
    ispHistoryTableBody.innerHTML = '';
    db.ispPayments.sort((a, b) => new Date(b.payDate) - new Date(a.payDate)).forEach(p => {
      const row = document.createElement('tr');
      const payDate = new Date(p.payDate);
      const formattedDate =
        `${toBengaliNumber(payDate.getDate())} ${months[payDate.getMonth()]} ${toBengaliNumber(payDate.getFullYear())}`;
      row.innerHTML = `
                <td>${months[p.month]} ${toBengaliNumber(p.year)}</td>
                <td>৳${toBengaliNumber(p.amount)}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn action-btn" style="background-color: #3182CE;" onclick="openIspEditModal('${p.id}')">Edit</button>
                    <button class="btn btn-delete action-btn" onclick="window.deleteIspPayment('${p.id}')">Del</button>
                </td>
            `;
      ispHistoryTableBody.appendChild(row);
    });
  }

  window.openIspEditModal = (id) => {
    const payment = db.ispPayments.find(p => p.id === id);
    if (payment) {
      document.getElementById("ispEditId").value = payment.id;
      document.getElementById("ispEditAmount").value = payment.amount;
      document.getElementById("ispEditPayDate").value = payment.payDate;
      populateDropdown("ispEditMonth", months.map((m, i) => ({
        value: i,
        text: m
      })), {
        defaultValue: payment.month
      });
      populateDropdown("ispEditYear", years, {
        defaultValue: payment.year
      });
      ispEditModal.classList.add("active");
      overlay.style.display = "block";
    }
  };
  ispEditModalClose.addEventListener('click', () => {
    ispEditModal.classList.remove('active');
    overlay.style.display = 'none';
  });
  ispEditForm.addEventListener("submit", e => {
    e.preventDefault();
    const id = document.getElementById("ispEditId").value;
    const payment = db.ispPayments.find(p => p.id === id);
    if (payment) {
      payment.amount = parseFloat(document.getElementById("ispEditAmount").value);
      payment.payDate = document.getElementById("ispEditPayDate").value;
      payment.month = parseInt(document.getElementById("ispEditMonth").value);
      payment.year = parseInt(document.getElementById("ispEditYear").value);
      saveDb();
      renderIspHistoryTable();
      ispEditModal.classList.remove("active");
      overlay.style.display = "none";
    }
  });

  window.deleteIspPayment = (id) => {
    if (confirm('আপনি কি নিশ্চিতভাবে এই বিলের ইতিহাসটি মুছে ফেলতে চান?')) {
      const payment = db.ispPayments.find(p => p.id === id);
      const monthName = months[payment.month];

      db.ispPayments = db.ispPayments.filter(p => p.id !== id);

      addActivity('isp_payment_deleted',
        `আইএসপি বিল মুছে ফেলা হয়েছে: ${monthName} ${payment.year} - ৳${payment.amount}`, {
          month: payment.month,
          year: payment.year,
          amount: payment.amount
        });

      saveDb();
      renderIspHistoryTable();
    }
  };

  document.getElementById('delete-all-isp-history-btn').addEventListener('click', () => {
    if (confirm('সতর্কতা! আপনি কি নিশ্চিতভাবে সকল আইএসপি বিলের ইতিহাস মুছে ফেলতে চান?')) {
      const deletedCount = db.ispPayments.length;
      db.ispPayments = [];

      addActivity('all_isp_history_deleted',
        `সকল আইএসপি বিল ইতিহাস মুছে ফেলা হয়েছে (${deletedCount} টি রেকর্ড)`, {
          deletedCount: deletedCount
        });

      saveDb();
      renderIspHistoryTable();
    }
  });

  function renderIspBillPage() {
    initializeIspForm();
    renderIspHistoryTable();
  }

  ispBillForm.addEventListener("submit", e => {
    e.preventDefault();
    const year = parseInt(document.getElementById("ispYear").value);
    const month = parseInt(document.getElementById("ispMonth").value);
    const amount = parseFloat(document.getElementById("ispAmount").value);
    const payDate = document.getElementById("ispPayDate").value;

    const existingPaymentIndex = db.ispPayments.findIndex(p => p.year === year && p.month === month);

    if (existingPaymentIndex > -1) {
      alert(
        `এই মাসের (${months[month]}, ${toBengaliNumber(year)}) জন্য আইএসপি বিল ইতিমধ্যে পরিশোধ করা হয়েছে। একই মাসে দ্বিতীয়বার পেমেন্ট করা যাবে না। তবে আপনি Edit বাটন দিয়ে এডিট করতে পারেন।`
        );
      return;
    } else {
      const payment = {
        id: Date.now().toString(),
        year: year,
        month: month,
        amount: amount,
        payDate: payDate
      };
      db.ispPayments.push(payment);
      alert("আইএসপি বিল সফলভাবে পরিশোধ করা হয়েছে।");

      addActivity('isp_payment', `আইএসপি বিল পরিশোধ করা হয়েছে`, {
        month: month,
        year: year,
        amount: amount
      });
    }
    saveDb();
    renderIspHistoryTable();
    ispBillForm.reset();
    initializeIspForm();
  });

  function initializeReportFilters() {
    const monthOptions = months.map((m, i) => ({
      value: i,
      text: m
    }));
    populateDropdown('reportYear', years, {
      defaultValue: new Date().getFullYear()
    });
    populateDropdown('reportMonth', monthOptions, {
      defaultValue: new Date().getMonth()
    });
  }

  function generateReport() {
    const year = document.getElementById('reportYear').value;
    const month = document.getElementById('reportMonth').value;
    const filteredBills = db.bills.filter(b => b.year == year && b.month == month);

    const totalRevenue = filteredBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.monthlyAmount + b
      .dueAmount, 0);
    const totalDues = filteredBills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.totalAmount, 0);
    const ispPaid = db.ispPayments.find(p => p.year == year && p.month == month)?.amount || 0;

    document.getElementById('total-revenue').textContent = `৳${toBengaliNumber(totalRevenue.toFixed(2))}`;
    document.getElementById('total-dues').textContent = `৳${toBengaliNumber(totalDues.toFixed(2))}`;
    document.getElementById('isp-paid-amount').textContent = `৳${toBengaliNumber(ispPaid.toFixed(2))}`;
    document.getElementById('net-income').textContent =
      `৳${toBengaliNumber((totalRevenue - ispPaid).toFixed(2))}`;

    const houseContainer = document.getElementById('house-reports-container');
    houseContainer.innerHTML = '';
    db.locations.forEach(houseName => {
      const houseBills = filteredBills.filter(b => {
        const customer = db.customers.find(c => c.id === b.customerId);
        return customer && customer.house === houseName;
      });
      const houseRevenue = houseBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.monthlyAmount + b
        .dueAmount, 0);
      if (houseBills.length > 0) {
        const houseCard = document.createElement('div');
        houseCard.className = 'summary-item';
        houseCard.innerHTML =
          `<h3>${houseName}</h3><p>আয়: ৳${toBengaliNumber(houseRevenue.toFixed(2))}</p>`;
        houseContainer.appendChild(houseCard);
      }
    });
  }

  function generatePdfReport() {
      const year = document.getElementById('reportYear').value;
      const month = document.getElementById('reportMonth').value;
      const filteredBills = db.bills.filter(b => b.year == year && b.month == month);
  
      const totalRevenue = filteredBills.reduce((sum, bill) => {
          return sum + (bill.paidAmount || 0);
      }, 0);
  
      const totalDues = filteredBills.reduce((sum, bill) => {
          return sum + (bill.remainingDue || 0);
      }, 0);
  
      const ispPaid = db.ispPayments.find(p => p.year == year && p.month == month)?.amount || 0;
      const netIncome = totalRevenue - ispPaid;
  
      const companyName = localStorage.getItem('websiteName') || 'Abid Network';
      const companyLogo = localStorage.getItem('websiteLogo') || 'https://i.ibb.co/Lz0dGqC/router-icon.png'; 
  
      const houseReportsHtml = db.locations.map(houseName => {
          const houseBills = filteredBills.filter(b => {
              const customer = db.customers.find(c => c.id === b.customerId);
              return customer && customer.house === houseName;
          });
          
          if (houseBills.length === 0) return '';
  
          const houseRevenue = houseBills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);
          
          if (houseRevenue === 0) return ''; 
  
          return `
              <tr>
                  <td>${houseName}</td>
                  <td>৳${toBengaliNumber(houseRevenue.toFixed(2))}</td>
              </tr>
          `;
      }).join('');
  
      const pdfContent = `
          <!DOCTYPE html>
          <html lang="bn">
          <head>
              <meta charset="UTF-8">
              <title>মাসিক রিপোর্ট - ${companyName}</title>
              <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet">
              <style>
                  body { font-family: 'Noto Sans Bengali', sans-serif; }
                  /* Add other necessary styles for PDF here */
              </style>
          </head>
          <body>
              <h1>${companyName} - মাসিক রিপোর্ট</h1>
              <h2>${months[month]}, ${toBengaliNumber(year)}</h2>
              <h3>মোট আয়: ৳${toBengaliNumber(totalRevenue.toFixed(2))}</h3>
              <h3>মোট বকেয়া: ৳${toBengaliNumber(totalDues.toFixed(2))}</h3>
              <h3>আইএসপি খরচ: ৳${toBengaliNumber(ispPaid.toFixed(2))}</h3>
              <h3>নিট আয়: ৳${toBengaliNumber(netIncome.toFixed(2))}</h3>
              <hr>
              <h2>বাড়ি ভিত্তিক আয়</h2>
              <table>
                  <thead><tr><th>বাড়ির নাম</th><th>আয়ের পরিমাণ</th></tr></thead>
                  <tbody>${houseReportsHtml}</tbody>
              </table>
          </body>
          </html>
      `;
  
      const printWindow = window.open('', '_blank');
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.onload = () => {
          setTimeout(() => {
              printWindow.print();
          }, 500); 
      };
  }


  function renderReportPage() {
    initializeReportFilters();
    generateReport();
    populateCustomerBillingHistoryDropdown();
  }
  document.getElementById('reportYear').addEventListener('change', generateReport);
  document.getElementById('reportMonth').addEventListener('change', generateReport);
  document.getElementById('printReportPdfBtn').addEventListener('click', generatePdfReport);

  function populateCustomerBillingHistoryDropdown() {
    const customerOptions = [{
      value: '',
      text: 'একটি গ্রাহক নির্বাচন করুন'
    }].concat(
      db.customers.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({
        value: c.id,
        text: `${c.name} (${c.house.split('ঃ')[0]})`
      }))
    );
    populateDropdown('customerBillingHistorySelect', customerOptions, {
      isBengali: false
    });
  }

  document.getElementById('downloadCustomerBillingHistoryBtn').addEventListener('click', () => {
    const customerId = document.getElementById('customerBillingHistorySelect').value;
    if (customerId) {
      generateCustomerBillingHistoryPdf(customerId);
    } else {
      alert('দয়া করে একটি গ্রাহক নির্বাচন করুন।');
    }
  });

  function generateCustomerBillingHistoryPdf(customerId) {
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) {
        alert('গ্রাহক খুঁজে পাওয়া যায়নি।');
        return;
    }

    const customerBills = db.bills
        .filter(b => b.customerId === customerId)
        .sort((a, b) => new Date(b.year, b.month) - new Date(a.year, a.month)); 

    const companyName = localStorage.getItem('websiteName') || 'Abid Network';
    const companyLogo = localStorage.getItem('websiteLogo') || 'https://i.ibb.co/Lz0dGqC/router-icon.png';

    const billingHistoryHtml = customerBills.map(bill => {
        let statusClass, statusText;
        if (bill.status === 'paid') {
            statusClass = 'status-paid';
            statusText = 'পরিশোধিত';
        } else if (bill.status === 'partially_paid') {
            statusClass = 'status-partial';
            statusText = 'আংশিক';
        } else {
            statusClass = 'status-unpaid';
            statusText = 'বকেয়া';
        }

        return `
            <tr>
                <td>${months[bill.month]}, ${toBengaliNumber(bill.year)}</td>
                <td>৳${toBengaliNumber(bill.totalAmount.toFixed(2))}</td>
                <td>৳${toBengaliNumber(bill.paidAmount.toFixed(2))}</td>
                <td>৳${toBengaliNumber(bill.remainingDue.toFixed(2))}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');

    const pdfContent = `
        <!DOCTYPE html>
        <html lang="bn">
        <head>
            <meta charset="UTF-8">
            <title>${customer.name} - বিলিং ইতিহাস</title>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Noto Sans Bengali', sans-serif; }
                /* Add necessary styles for PDF here */
            </style>
        </head>
        <body>
            <h1>${companyName}</h1>
            <h2>${customer.name} - বিলিং ইতিহাস</h2>
            <p>ফোন: ${customer.phone || 'N/A'}</p>
            <p>বাড়ি: ${customer.house}</p>
            <table>
                <thead>
                    <tr>
                        <th>মাস/বছর</th>
                        <th>মোট বিল</th>
                        <th>পরিশোধিত</th>
                        <th>বকেয়া</th>
                        <th>স্ট্যাটাস</th>
                    </tr>
                </thead>
                <tbody>${billingHistoryHtml}</tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };
}

  function renderSettingsPage() {
    const websiteNameInput = document.getElementById('websiteName');
    const websiteLogoInput = document.getElementById('websiteLogo');
    const updateNameBtn = document.getElementById('updateWebsiteNameBtn');
    const updateLogoBtn = document.getElementById('updateWebsiteLogoBtn');

    const currentName = localStorage.getItem('websiteName') || 'Abid Network';
    websiteNameInput.value = currentName;

    updateNameBtn.addEventListener('click', () => {
      const newName = websiteNameInput.value.trim();
      if (newName) {
        localStorage.setItem('websiteName', newName);
        document.querySelector('.header-title span').textContent = newName;
        document.querySelector('.sidebar-header span').textContent = newName;
        document.title = newName;
        alert('ওয়েবসাইটের নাম সফলভাবে আপডেট করা হয়েছে।');
      } else {
        alert('দয়া করে একটি বৈধ নাম লিখুন।');
      }
    });

    updateLogoBtn.addEventListener('click', () => {
      const logoFile = websiteLogoInput.files[0];
      if (logoFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const logoDataUrl = e.target.result;
          localStorage.setItem('websiteLogo', logoDataUrl);
          document.querySelector('.header-title img').src = logoDataUrl;
          document.querySelector('.sidebar-header img').src = logoDataUrl;
          alert('ওয়েবসাইটের লোগো সফলভাবে আপডেট করা হয়েছে।');
        };
        reader.readAsDataURL(logoFile);
      } else {
        alert('দয়া করে একটি ছবি নির্বাচন করুন।');
      }
    });

    const locationList = document.getElementById('locationList');
    const locationForm = document.getElementById('locationForm');
    const locationEditModal = document.getElementById('locationEditModal');
    const locationEditForm = document.getElementById('locationEditForm');
    const locationEditModalClose = document.getElementById('location-edit-modal-close');

    function renderLocations() {
      locationList.innerHTML = '';
      db.locations.forEach(loc => {
        const li = document.createElement('li');
        li.innerHTML = `
                    <span class="location-name">${loc}</span>
                    <div class="actions">
                        <button class="btn action-btn" style="background-color: #3182CE;" onclick="openLocationEditModal('${loc}')">Edit</button>
                        <button class="btn btn-delete action-btn" onclick="deleteLocation('${loc}')">Del</button>
                    </div>
                `;
        locationList.appendChild(li);
      });
    }

    locationForm.addEventListener('submit', e => {
      e.preventDefault();
      const newLocationInput = document.getElementById('newLocationName');
      const newLocation = newLocationInput.value.trim();
      if (newLocation && !db.locations.includes(newLocation)) {
        db.locations.push(newLocation);
        addActivity('location_added', `নতুন বাড়ি যোগ করা হয়েছে: ${newLocation}`, {
          locationName: newLocation
        });
        saveDb();
        renderLocations();
        newLocationInput.value = '';
      } else {
        alert('এই লোকেশনটি ইতিমধ্যে বিদ্যমান অথবা নামটি খালি।');
      }
    });

    window.openLocationEditModal = (oldName) => {
      document.getElementById('locationEditOldName').value = oldName;
      document.getElementById('locationEditNewName').value = oldName;
      locationEditModal.classList.add('active');
      overlay.style.display = 'block';
    };

    locationEditForm.addEventListener('submit', e => {
      e.preventDefault();
      const oldName = document.getElementById('locationEditOldName').value;
      const newName = document.getElementById('locationEditNewName').value.trim();
      if (newName && oldName !== newName && !db.locations.includes(newName)) {
        db.customers.forEach(c => {
          if (c.house === oldName) c.house = newName;
        });
        db.routers.forEach(r => {
          if (r.location === oldName) r.location = newName;
        });
        const index = db.locations.indexOf(oldName);
        if (index > -1) db.locations[index] = newName;
        saveDb();
        renderLocations();
        locationEditModal.classList.remove('active');
        overlay.style.display = 'none';
      } else {
        alert('নতুন নাম খালি, একই অথবা ইতিমধ্যে বিদ্যমান।');
      }
    });

    locationEditModalClose.addEventListener('click', () => {
      locationEditModal.classList.remove('active');
      overlay.style.display = 'none';
    });

    window.deleteLocation = (locName) => {
      if (defaultLocations.includes(locName)) {
                alert('ডিফল্ট লোকেশন মুছে ফেলা যাবে না।');
        return;
      }
      if (confirm(
          `আপনি কি নিশ্চিতভাবে "${locName}" লোকেশনটি মুছে ফেলতে চান? এই লোকেশনের সকল গ্রাহক এবং রাউটারের তথ্যও প্রভাবিত হতে পারে।`
          )) {
        db.locations = db.locations.filter(l => l !== locName);

        addActivity('location_deleted', `বাড়ি মুছে ফেলা হয়েছে: ${locName}`, {
          locationName: locName
        });

        saveDb();
        renderLocations();
      }
    };

    renderLocations();
  }

  const exportBtn = document.getElementById('export-data-btn');
  const importBtn = document.getElementById('import-data-btn');
  const importInput = document.getElementById('import-file-input');
  const resetBtn = document.getElementById('reset-app-btn');

  exportBtn.addEventListener('click', () => {
    const fullBackupData = {
      db: db,
      activities: loadActivities()
    };
    const dataStr = JSON.stringify(fullBackupData, null, 2);
    const dataBlob = new Blob([dataStr], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    const fileName = `abid_network_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    addActivity('data_backup', 'সিস্টেমের সকল ডেটা ব্যাকআপ নেওয়া হয়েছে', {
      fileName: fileName
    });

    const now = new Date();
    const bengaliDate = now.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    localStorage.setItem('lastExportDate', bengaliDate);
    updateLastExportDate();
    hideBackupReminder();
    renderDashboard(); 
  });

  importBtn.addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        let dbToLoad, activitiesToLoad = [];

        if (importedData.db && importedData.activities) {
          dbToLoad = importedData.db;
          activitiesToLoad = importedData.activities;
        } else if (importedData.customers && importedData.bills) {
          dbToLoad = importedData;
        } else {
          alert('ফাইলটির ফরম্যাট বোঝা যাচ্ছে না। এটি একটি অবৈধ ফাইল।');
          event.target.value = '';
          return;
        }

        if (confirm(
            'আপনি কি নিশ্চিতভাবে এই ডেটা ইমপোর্ট করতে চান? বর্তমান সকল ডেটা মুছে নতুন ডেটা যোগ করা হবে।'
            )) {
          db = migrateDb(dbToLoad);
          saveDb();
          saveActivities(activitiesToLoad);

          addActivity('data_import', 'ব্যাকআপ ফাইল থেকে ডেটা পুনরুদ্ধার করা হয়েছে', {
            fileName: file.name
          });

          alert('ডেটা সফলভাবে ইমপোর্ট করা হয়েছে।');
          location.reload();
        }
      } catch (err) {
        console.error("Import failed:", err);
        alert('ভুল ফাইল ফরম্যাট বা ফাইলটি পড়তে সমস্যা হয়েছে।');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  resetBtn.addEventListener('click', () => {
    if (confirm(
        'সতর্কতা! আপনি কি নিশ্চিতভাবে অ্যাপের সকল ডেটা মুছে ফেলতে চান? এই কাজটি ফেরানো যাবে না। ডিফল্ট লোকেশনগুলো পুনরুদ্ধার করা হবে।'
        )) {

      localStorage.removeItem(DATABASE_KEY);
      localStorage.removeItem('abidNetworkDb_v40'); 
      localStorage.removeItem(LAST_PAGE_KEY);
      localStorage.removeItem(ACTIVITY_STORAGE_KEY); 
      localStorage.removeItem('lastExportDate'); 

      alert('অ্যাপ সফলভাবে রিসেট করা হয়েছে।');
      location.reload(); 
    }
  });
  const loadMoreBtn = document.getElementById('load-more-activities-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      renderRecentActivities(true);
    });
  }

  function setFooterYear() {
    const yearSpan = document.getElementById('footer-year');
    if (yearSpan) {
      yearSpan.textContent = toBengaliNumber(new Date().getFullYear());
    }
  }

  const customerProfileModal = document.getElementById('customerProfileModal');
  const customerProfileModalClose = document.getElementById('customer-profile-modal-close');

  function getCustomerFinancialStatus(customerId) {
    const customer = db.customers.find(c => c.id === customerId);
    if (customer.isFree) {
        return {
            icon: '⭐',
            text: 'ফ্রি গ্রাহক',
            color: '#319795'
        };
    }
    if (!customer) return null;

    const isActive = customer.isActive === undefined ? true : customer.isActive;
    if (!isActive) {
      let inactiveText = 'নিষ্ক্রিয়';
      if (customer.advanceBalance > 0) {
        inactiveText += ` (অ্যাডভান্স: ৳${toBengaliNumber(customer.advanceBalance.toFixed(2))})`;
      }
      return {
        icon: '⚠️',
        text: inactiveText,
        color: '#E53E3E'
      };
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const currentBill = db.bills.find(b =>
      b.customerId === customerId &&
      b.year === currentYear &&
      b.month === currentMonth
    );

    if (currentBill) {
      if (currentBill.status === 'paid') {
        if (customer.advanceBalance > 0) {
          return {
            icon: '✨',
            text: `অ্যাডভান্স: ৳${toBengaliNumber(customer.advanceBalance.toFixed(2))}`,
            color: '#3182CE'
          };
        }
        return {
          icon: '✅',
          text: 'পরিশোধিত',
          color: '#38A169'
        };
      }

      const dueFromAdjustments = (currentBill.adjustments || [])
        .filter(adj => adj.type === 'due')
        .reduce((sum, adj) => sum + adj.amount, 0);

      const totalPreviousDue = (currentBill.dueAmount || 0) + dueFromAdjustments;

      if (totalPreviousDue > 0 && currentBill.paidAmount === 0) {
        return {
          icon: '❗',
          text: `পূর্বের বকেয়া: ৳${toBengaliNumber(totalPreviousDue.toFixed(2))}`,
          color: '#DD6B20'
        };
      }

      if (currentBill.paidAmount > 0 && currentBill.remainingDue > 0) {
        return {
          icon: '⏳',
          text: `বর্তমান বকেয়া: ৳${toBengaliNumber(currentBill.remainingDue.toFixed(2))}`,
          color: '#DD6B20'
        };
      }

      return {
        icon: '📄',
        text: 'বিল প্রস্তুত',
        color: '#4A5568'
      };

    } else {
      if (customer.advanceBalance > 0) {
        return {
          icon: '✨',
          text: `অ্যাডভান্স: ৳${toBengaliNumber(customer.advanceBalance.toFixed(2))}`,
          color: '#3182CE'
        };
      }
      return {
        icon: '🗓️',
        text: 'বিল তৈরি হয়নি',
        color: '#718096'
      };
    }
  }

  window.openCustomerProfile = (customerId) => {
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById("profile-customer-name").textContent = customer.name;
    document.getElementById("profile-phone").textContent = customer.phone || 'N/A';
    document.getElementById("profile-house").textContent = customer.house;
    document.getElementById("profile-bill").textContent = customer.isFree ? 'প্রযোজ্য নয়' : `৳${toBengaliNumber(customer.monthlyBill.toFixed(2))}`;
    document.getElementById("profile-connection-date").textContent = toBengaliNumber(new Date(customer
      .connectionDate).toLocaleDateString('bn-BD'));
    document.getElementById("profile-mac").textContent = customer.macAddress || 'N/A';

    const financialStatus = getCustomerFinancialStatus(customerId);
    const statusContainer = document.getElementById('profile-status-container');
    const statusIcon = document.getElementById('profile-status-icon');
    const statusText = document.getElementById('profile-status-text');

    if (financialStatus) {
      statusIcon.textContent = financialStatus.icon;
      statusText.textContent = financialStatus.text;
      statusText.style.color = financialStatus.color;
      statusContainer.style.display = 'flex';
    } else {
      statusContainer.style.display = 'none';
    }

    const billingHistoryContainer = document.getElementById('profile-billing-history');
    billingHistoryContainer.innerHTML = '';
    const customerBills = db.bills.filter(b => b.customerId === customerId)
      .sort((a, b) => new Date(b.year, b.month) - new Date(a.year, a.month));

    if (customerBills.length === 0) {
      billingHistoryContainer.innerHTML =
        '<li style="text-align: center; padding: 10px; font-size: 12px; color: #6c757d;">কোনো বিলের ইতিহাস পাওয়া যায়নি।</li>';
    } else {
      customerBills.forEach(bill => {
        const li = document.createElement('li');
        let statusClass, statusText, dueText = '';

        const totalBillAmount = bill.monthlyAmount + (bill.dueAmount || 0) +
          ((bill.adjustments || []).filter(a => a.type === 'due').reduce((sum, a) => sum + a.amount, 0));

        if (bill.status === 'paid') {
          statusClass = 'status-paid';
          statusText = 'পরিশোধিত';
        } else if (bill.status === 'partially_paid') {
          statusClass = 'status-partially-paid';
          statusText = 'আংশিক';
          if (bill.remainingDue > 0) {
            dueText =
            `<span class="due">বকেয়া: ৳${toBengaliNumber(bill.remainingDue.toFixed(2))}</span>`;
          }
        } else {
          statusClass = 'status-unpaid';
          statusText = 'বকেয়া';
        }

        li.className = `billing-history-item ${statusClass}`;
        li.innerHTML = `
            <div class="item-info">
                <span class="month">${months[bill.month]}, ${toBengaliNumber(bill.year)}</span>
                <span class="details">মোট বিল: ৳${toBengaliNumber(totalBillAmount.toFixed(2))}</span>
            </div>
            <div class="item-status">
                <span class="status">${statusText}</span>
                ${dueText}
            </div>
        `;
        billingHistoryContainer.appendChild(li);
      });
    }

    const actionButtonContainer = document.getElementById('profile-action-buttons');
    const isActive = customer.isActive === undefined ? true : customer.isActive;

    if (isActive) {
      actionButtonContainer.innerHTML =
        `<button class="simple-status-btn btn-is-active" onclick="deactivateCustomer('${customer.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><span>সক্রিয়</span></button>`;
    } else {
      actionButtonContainer.innerHTML =
        `<button class="simple-status-btn btn-is-inactive" onclick="reactivateCustomer('${customer.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg><span>নিষ্ক্রিয়</span></button>`;
    }

    const customerProfileModal = document.getElementById('customerProfileModal');
    customerProfileModal.classList.add('active');
    document.getElementById('overlay').style.display = 'block';
  };

  window.deactivateCustomer = function(customerId) {
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) return;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const currentBill = db.bills.find(b =>
      b.customerId === customerId &&
      b.year === currentYear &&
      b.month === currentMonth
    );

    if (currentBill && currentBill.status !== 'paid') {
      if (confirm(
          `এই গ্রাহকের চলতি মাসের বিল (${months[currentMonth]}) তৈরি করা আছে।\n\nআপনি কি চান যে বিলটি পরিশোধ হওয়ার সাথে সাথে গ্রাহক স্বয়ংক্রিয়ভাবে নিষ্ক্রিয় হয়ে যাক?`
          )) {
        customer.deactivationPending = true;
        saveDb();
        alert(
          `অনুরোধটি গ্রহণ করা হয়েছে।\n${customer.name}-এর বিল পরিশোধ হওয়ার পর সংযোগটি স্বয়ংক্রিয়ভাবে নিষ্ক্রিয় হয়ে যাবে।`
          );
        closeCustomerProfile();
        renderCustomerListPage();
      }
    } else {
      if (confirm(`আপনি কি নিশ্চিতভাবে ${customer.name}-এর সংযোগ নিষ্ক্রিয় করতে চান?`)) {
        customer.isActive = false;
        customer.deactivationPending = false;
        saveDb();
        alert(`${customer.name}-এর সংযোগ সফলভাবে নিষ্ক্রিয় করা হয়েছে।`);
        closeCustomerProfile();
        renderCustomerListPage();
      }
    }
  }

  window.reactivateCustomer = function(customerId) {
    const customer = db.customers.find(c => c.id === customerId);
    if (customer) {
      customer.isActive = true;
      saveDb();
      alert(`${customer.name}-এর সংযোগ সফলভাবে পুনরায় সক্রিয় করা হয়েছে।`);
      closeCustomerProfile();
      renderCustomerListPage();
    }
  }

  function closeCustomerProfile() {
    const customerProfileModal = document.getElementById('customerProfileModal');
    const overlay = document.getElementById('overlay');
    if (customerProfileModal) {
      customerProfileModal.classList.remove('active');
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  customerProfileModalClose.addEventListener('click', () => {
    customerProfileModal.classList.remove('active');
    overlay.style.display = 'none';
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      sidebar.classList.remove('active');
      customerProfileModal.classList.remove('active');
      ispEditModal.classList.remove('active');
      adjustmentModal.classList.remove('active');
      locationEditModal.classList.remove('active');
      overlay.style.display = 'none';
    }
  });

  loadDb();
  setFooterYear();

  const savedName = localStorage.getItem('websiteName');
  const savedLogo = localStorage.getItem('websiteLogo');

  if (savedName) {
      document.getElementById("header-company-name").textContent = savedName;
      document.getElementById("sidebar-company-name").textContent = savedName;
      document.title = savedName;
  }

  if (savedLogo) {
      const headerLogoImg = document.getElementById("header-company-logo");
      headerLogoImg.src = savedLogo;
      headerLogoImg.style.display = "inline-block"; 
      const sidebarLogoImg = document.getElementById("sidebar-company-logo");
      sidebarLogoImg.src = savedLogo;
      sidebarLogoImg.style.display = "inline-block"; 
  }

  const lastPage = localStorage.getItem(LAST_PAGE_KEY) || 'dashboard';
  switchPage(lastPage, true);

  function submitPayment() {
    const receivedAmountInput = document.getElementById('payment-amount-input');
    const receivedAmount = parseFloat(receivedAmountInput.value);

    if (isNaN(receivedAmount) || receivedAmount <= 0) {
      alert('অনুগ্রহ করে একটি বৈধ টাকার পরিমাণ লিখুন!');
      return;
    }

    if (!currentPaymentBillId) {
      alert('ত্রুটি: বিল আইডি পাওয়া যায়নি!');
      return;
    }

    const paymentResult = logPayment(currentPaymentBillId, receivedAmount);

    if (paymentResult.success) {
      alert(paymentResult.message); 
    } else {
      alert(`একটি ত্রুটি ঘটেছে: ${paymentResult.message}`);
    }

    closePaymentModal();
    renderBillingPage();
    renderDashboard();
  }

  function recalculateBillTotal(billId) {
    const bill = db.bills.find(b => b.id === billId);
    if (!bill) return;

    const customer = db.customers.find(c => c.id === bill.customerId);
    if (!customer) return;

    const dueFromAdjustments = (bill.adjustments || []).filter(a => a.type === 'due').reduce((sum, a) => sum + a
      .amount, 0);
    const grossTotalBill = bill.monthlyAmount + bill.dueAmount + dueFromAdjustments;
    const discount = bill.discount || 0;
    const netTotalBill = grossTotalBill - discount;

    bill.paidAmount = (bill.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);

    let remainingDue = netTotalBill - bill.paidAmount;

    if (remainingDue > 0 && (customer.advanceBalance || 0) > 0) {
      const amountToUseFromAdvance = Math.min(remainingDue, customer.advanceBalance);

      customer.advanceBalance -= amountToUseFromAdvance;
      bill.paidAmount += amountToUseFromAdvance;
      bill.advanceUsed = (bill.advanceUsed || 0) + amountToUseFromAdvance;

      if (!bill.paymentHistory) {
        bill.paymentHistory = [];
      }
      bill.paymentHistory.push({
        id: Date.now() + Math.random(),
        amount: amountToUseFromAdvance,
        date: new Date().toISOString(),
        source: 'advance',
        balanceAfter: remainingDue - amountToUseFromAdvance
      });

      remainingDue -= amountToUseFromAdvance;
    }

    if (remainingDue < 0) {
      const newAdvance = Math.abs(remainingDue);
      customer.advanceBalance = (customer.advanceBalance || 0) + newAdvance;
      remainingDue = 0;
    }

    bill.totalAmount = grossTotalBill;
    bill.remainingDue = remainingDue;

    if (bill.remainingDue <= 0) {
      bill.status = 'paid';
      bill.isPaid = true;
    } else if (bill.paidAmount > 0) {
      bill.status = 'partially_paid';
      bill.isPaid = false;
    } else {
      bill.status = 'unpaid';
      bill.isPaid = false;
    }
  }

  const applyDiscountBtn = document.getElementById('apply-discount-btn');
  if (applyDiscountBtn) {
    applyDiscountBtn.addEventListener('click', () => {
      const discountAmountInput = document.getElementById('discount-amount-input');
      const discountAmount = parseFloat(discountAmountInput.value);

      if (isNaN(discountAmount) || discountAmount <= 0) { 
        alert('অনুগ্রহ করে একটি বৈধ ছাড়ের পরিমাণ লিখুন!');
        return;
      }

      if (!currentPaymentBillId) {
        alert('ত্রুটি: বিল আইডি পাওয়া যায়নি!');
        return;
      }

      const bill = db.bills.find(b => b.id === currentPaymentBillId);
      if (!bill) {
        alert('ত্রুটি: বিল খুঁজে পাওয়া যায়নি!');
        return;
      }

      const customer = db.customers.find(c => c.id === bill.customerId);
      if (!customer) return;

      const totalBill = bill.totalAmount || 0;
      const paidAmount = bill.paidAmount || 0;
      const maxDiscount = totalBill - paidAmount;

      if (discountAmount > maxDiscount) {
        alert(`আপনি সর্বোচ্চ ৳${toBengaliNumber(maxDiscount.toFixed(2))} পর্যন্ত ছাড় দিতে পারবেন।`);
        return;
      }

      bill.discount = (bill.discount || 0) + discountAmount;
      recalculateBillTotal(bill.id);
      saveDb();

      alert(`৳${toBengaliNumber(discountAmount.toFixed(2))} ছাড় সফলভাবে প্রয়োগ করা হয়েছে।`);

      addActivity('discount_applied',
        `${customer.name}-কে ৳${toBengaliNumber(discountAmount.toFixed(2))} বিশেষ ছাড় দেওয়া হয়েছে`, {
          customerName: customer.name,
          amount: discountAmount,
          month: bill.month,
          year: bill.year
        });

      openPaymentModal(bill.id);
      discountAmountInput.value = ''; 
    });
  }

  function logPayment(billId, receivedAmount) {
    const billIndex = db.bills.findIndex(b => b.id === billId);
    if (billIndex === -1) return {
      success: false,
      message: 'বিল খুঁজে পাওয়া যায়নি।'
    };

    const bill = db.bills[billIndex];
    const customer = db.customers.find(c => c.id === bill.customerId);
    if (!customer) return {
      success: false,
      message: 'গ্রাহক খুঁজে পাওয়া যায়নি।'
    };

    if (!bill.paymentHistory) bill.paymentHistory = [];

    const dueBeforeThisPayment = bill.remainingDue > 0 ? bill.remainingDue : 0;

    if (dueBeforeThisPayment <= 0) {
      customer.advanceBalance = (customer.advanceBalance || 0) + receivedAmount;
      bill.paymentHistory.push({
        id: Date.now() + Math.random(),
        amount: receivedAmount,
        date: new Date().toISOString(),
        source: 'advance_deposit',
        balanceAfter: -customer.advanceBalance,
        isFirstAdvance: (customer.advanceBalance === receivedAmount)
      });
      saveDb();
      addActivity('advance_deposit', `${customer.name}-এর অ্যাকাউন্টে অ্যাডভান্স জমা হয়েছে`, {
        customerName: customer.name,
        amount: receivedAmount
      });
      return {
        success: true,
        message: `সরাসরি ৳${toBengaliNumber(receivedAmount)} অ্যাডভান্স জমা হয়েছে।`
      };
    }

    const balanceAfterPayment = dueBeforeThisPayment - receivedAmount;
    let isFinalPayment = false;
    let newAdvanceFromThisPayment = 0;

    if (balanceAfterPayment <= 0) {
      isFinalPayment = true;
      if (balanceAfterPayment < 0) {
        newAdvanceFromThisPayment = Math.abs(balanceAfterPayment);
      }
    }

    bill.paymentHistory.push({
      id: Date.now() + Math.random(),
      amount: receivedAmount,
      date: new Date().toISOString(),
      source: 'manual',
      balanceAfter: balanceAfterPayment,
      isFinalPayment: isFinalPayment,
      newAdvance: newAdvanceFromThisPayment
    });
    bill.paidAmount = (bill.paidAmount || 0) + receivedAmount;
    recalculateBillTotal(billId);

    let finalMessage = "পেমেন্ট সফলভাবে জমা হয়েছে।";
    let wasDeactivated = false;

    if (bill.status === 'paid' && customer.deactivationPending === true) {
      customer.isActive = false;
      customer.deactivationPending = false;
      wasDeactivated = true;

      finalMessage = `পেমেন্ট সফলভাবে জমা হয়েছে এবং গ্রাহক "${customer.name}"-কে নিষ্ক্রিয় করা হয়েছে।`;

      addActivity('customer_deactivated_auto',
        `বিল পরিশোধের পর ${customer.name} স্বয়ংক্রিয়ভাবে নিষ্ক্রিয় হয়েছে।`, {
          customerName: customer.name
        });
    }

    saveDb();

    if (bill.status === 'paid') {
      addActivity('bill_status_paid', `${customer.name}-এর বিল সম্পূর্ণ পরিশোধিত হয়েছে`, {
        customerName: customer.name,
        amount: receivedAmount,
        month: bill.month,
        year: bill.year
      });

      const dueBeforeThisPayment = bill.totalAmount - (bill.paidAmount - receivedAmount) - (bill.discount || 0);
      const overPayment = receivedAmount - dueBeforeThisPayment;

      if (overPayment > 0) {
        addActivity('advance_deposit',
          `${customer.name}-এর অ্যাকাউন্টে অতিরিক্ত ৳${toBengaliNumber(overPayment.toFixed(2))} অ্যাডভান্স জমা হয়েছে`, {
            customerName: customer.name,
            amount: overPayment,
            source: 'Overpayment' 
          });
      }

    } else if (bill.status === 'partially_paid') {
      addActivity('payment_history', `${customer.name}-এর বিল আংশিক পরিশোধ করা হয়েছে`, {
        customerName: customer.name,
        amount: receivedAmount,
        remainingDue: bill.remainingDue,
        month: bill.month,
        year: bill.year
      });
    }

    return {
      success: true,
      message: finalMessage,
      deactivated: wasDeactivated
    };
  }

  const submitPaymentBtn = document.getElementById('submit-payment-btn');
  const closeModalBtn = document.querySelector('.payment-modal-close');
  const cancelModalBtn = document.querySelector('.payment-btn-cancel');

  if (submitPaymentBtn) {
    submitPaymentBtn.addEventListener('click', submitPayment);
  }
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closePaymentModal);
  }
  if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', closePaymentModal);
  }
  const clearActivityLogBtn = document.getElementById('clear-activity-log-btn');

  if (clearActivityLogBtn) {
    clearActivityLogBtn.addEventListener('click', () => {
      if (confirm(
          'আপনি কি নিশ্চিতভাবে সকল সাম্প্রতিক কার্যক্রমের লগ মুছে ফেলতে চান? এই কাজটি ফেরানো যাবে না।')) {

        const ACTIVITY_STORAGE_KEY = 'abidNetworkActivities_v1';
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);

        const activitiesContainer = document.getElementById('recent-activities');
        const noActivitiesDiv = document.getElementById('no-activities');
        const loadMoreBtnContainer = document.getElementById('activity-loader');

        if (activitiesContainer) {
          activitiesContainer.innerHTML = '';
          activitiesContainer.style.display = 'none';
        }
        if (noActivitiesDiv) {
          noActivitiesDiv.style.display = 'block';
        }
        if (loadMoreBtnContainer) {
          loadMoreBtnContainer.style.display = 'none';
        }
        renderRecentActivities();

        alert('সকল কার্যক্রমের লগ সফলভাবে মুছে ফেলা হয়েছে।');
      }
    });
  }

  initializeVersionManagement();

  function setupMacInput(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.style.position = 'relative';

    const realInput = document.createElement('input');
    realInput.type = 'text';
    realInput.maxLength = 17;
    realInput.placeholder = 'XX:XX:XX:XX:XX:XX';

    realInput.id = containerId + '-real-input'; 

    realInput.style.width = '100%';
    realInput.style.border = '1px solid #ccc';
    realInput.style.padding = '8px';
    realInput.style.letterSpacing = '3px';
    realInput.style.fontFamily = 'monospace';
    realInput.style.fontSize = '16px';
    realInput.style.boxSizing = 'border-box';

    container.appendChild(realInput);

    const formatMacAddress = (e) => {
      let value = realInput.value;
      let cleanValue = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
      let formattedValue = '';
      for (let i = 0; i < cleanValue.length; i++) {
        if (i > 0 && i % 2 === 0) {
          formattedValue += ':';
        }
        formattedValue += cleanValue[i];
      }
      realInput.value = formattedValue;
    };

    realInput.addEventListener('input', formatMacAddress);

    realInput.addEventListener('paste', (e) => {
      setTimeout(() => {
        formatMacAddress(e);
      }, 0);
    });
  }

  const macStyle = document.createElement('style');
  macStyle.textContent = `
.mac-input-container { display: flex; align-items: center; gap: 5px; }
.mac-input-box {
    width: 15%; height: 32px; text-align: center;
    font-family: 'Courier New', monospace; font-size: 14px;
    font-weight: 600; text-transform: uppercase;
    border: 1px solid #CBD5E0; border-radius: 5px; padding: 0;
}
.mac-input-box:focus {
    border-color: var(--secondary-color); outline: none;
    box-shadow: 0 0 5px rgba(90, 103, 216, 0.3);
}
.mac-separator { font-size: 16px; font-weight: bold; color: #A0AEC0; }
`;
  document.head.appendChild(macStyle);

});

function getMacAddress(containerId) {
  const realInput = document.getElementById(containerId + '-real-input');
  if (realInput && realInput.value.length === 17) {
    return realInput.value.toUpperCase();
  }
  return '';
}

function setMacAddress(containerId, mac) {
  const realInput = document.getElementById(containerId + '-real-input');
  if (realInput) {
    realInput.value = mac || '';
  }
}

function initializeVersionManagement() {
  updateSystemVersion();
  updateLastUpdateDate();
}

function updateSystemVersion() {
  const currentVersion = "v4.3.0";
  const versionElement = document.getElementById('system-version');
  if (versionElement) {
    versionElement.textContent = currentVersion;
  }
}

function updateLastUpdateDate() {
  const lastUpdateString = "০৯ আগষ্ট ২০২৫";
  const dateElement = document.getElementById('last-update-date');
  if (dateElement) {
    dateElement.textContent = lastUpdateString;
  }
}

function showChangeLog() {
  const changeLogModal = document.getElementById("changeLogModal");
  const overlay = document.getElementById("overlay");
  if (!changeLogModal) {
    createChangeLogModal();
  }
  document.getElementById("changeLogModal").classList.add("active");
  overlay.style.display = "block";
}

function createChangeLogModal() {
  const modalHTML = `
    <div class="modal" id="changeLogModal">
        <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 style="color: var(--secondary-color); display: flex; align-items: center; gap: 10px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                    </svg>
                    Change Log
                </h2>
                <button class="modal-close" id="changeLogModalCloseBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="changelog-content">
                    <div class="version-block">
                        <h3 style="color: var(--primary-color); border-bottom: 2px solid var(--primary-color); padding-bottom: 5px;">v4.2.0 - ২৪ জুলাই ২০২৫</h3>
                        <div class="change-category">
                            <h4 style="color: #28a745;">✨ নতুন ফিচার</h4>
                            <ul>
                                <li>স্বয়ংক্রিয় ভার্সন আপডেট সিস্টেম যোগ করা হয়েছে</li>
                                <li>শেষ আপডেটের তারিখ স্বয়ংক্রিয়ভাবে প্রদর্শন</li>
                                <li>Change Log বাটন এবং পপআপ উইন্ডো যোগ করা হয়েছে</li>
                                <li>আপডেট ইতিহাস ট্র্যাকিং সিস্টেম</li>
                            </ul>
                        </div>
                        <div class="change-category">
                            <h4 style="color: #17a2b8;">🔧 উন্নতি</h4>
                            <ul>
                                <li>About পেইজের UI/UX উন্নত করা হয়েছে</li>
                                <li>ভার্সন তথ্য প্রদর্শনী আরও আকর্ষণীয় করা হয়েছে</li>
                                <li>Change Log এর জন্য সুন্দর ডিজাইন যোগ করা হয়েছে</li>
                            </ul>
                        </div>
                    </div>

                    <div class="version-block">
                        <h3 style="color: var(--primary-color); border-bottom: 2px solid var(--primary-color); padding-bottom: 5px;">v4.1.0 - জানুয়ারি ২০২৫</h3>
                        <div class="change-category">
                            <h4 style="color: #28a745;">✨ নতুন ফিচার</h4>
                            <ul>
                                <li>About পেইজ যোগ করা হয়েছে</li>
                                <li>সিস্টেম তথ্য প্রদর্শনী</li>
                                <li>যোগাযোগের তথ্য সেকশন</li>
                                <li>ডেভলপমেন্ট টিমের তথ্য</li>
                            </ul>
                        </div>
                        <div class="change-category">
                            <h4 style="color: #17a2b8;">🔧 উন্নতি</h4>
                            <ul>
                                <li>নেভিগেশন মেনুতে About লিংক যোগ</li>
                                <li>রেসপন্সিভ ডিজাইন উন্নত করা</li>
                            </ul>
                        </div>
                    </div>

                    <div class="version-block">
                        <h3 style="color: var(--primary-color); border-bottom: 2px solid var(--primary-color); padding-bottom: 5px;">v4.0.0 - ডিসেম্বর ২০২৪</h3>
                        <div class="change-category">
                            <h4 style="color: #28a745;">✨ নতুন ফিচার</h4>
                            <ul>
                                <li>রাউটার ম্যানেজমেন্ট সিস্টেম</li>
                                <li>উন্নত বিল ব্যবস্থাপনা</li>
                                <li>গ্রাহক প্রোফাইল সিস্টেম</li>
                                <li>রিপোর্ট জেনারেশন</li>
                            </ul>
                        </div>
                        <div class="change-category">
                            <h4 style="color: #ffc107;">🐛 বাগ ফিক্স</h4>
                            <ul>
                                <li>ডেটা সেভ করার সমস্যা সমাধান</li>
                                <li>মোবাইল রেসপন্সিভনেস উন্নত করা</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  document.getElementById("changeLogModalCloseBtn").addEventListener("click", closeChangeLogModal);

  const style = document.createElement("style");
  style.textContent = `
        .changelog-content {
            font-family: 'Noto Sans Bengali', sans-serif;
        }
        .version-block {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #fafafa;
        }
        .version-block h3 {
            margin-top: 0;
            margin-bottom: 15px;
        }
        .change-category {
            margin-bottom: 15px;
        }
        .change-category h4 {
            margin-bottom: 8px;
            font-size: 16px;
        }
        .change-category ul {
            margin: 0;
            padding-left: 20px;
        }
        .change-category li {
            margin-bottom: 5px;
            line-height: 1.5;
        }
    `;
  document.head.appendChild(style);
}

function closeChangeLogModal() {
  document.getElementById("changeLogModal").classList.remove("active");
  document.getElementById("overlay").style.display = "none";
}

function showBackupReminder() {
  const notification = document.getElementById('backup-reminder-notification');
  if (notification) {
    notification.style.display = 'block';
  }

  const dashboardNotification = document.getElementById('dashboard-backup-reminder-notification');
  if (dashboardNotification) {
    dashboardNotification.style.display = 'block';
  }
}

function hideBackupReminder() {
  const notification = document.getElementById('backup-reminder-notification');
  if (notification) {
    notification.style.display = 'none';
  }
}

function hideDashboardBackupReminder() {
  const dashboardNotification = document.getElementById('dashboard-backup-reminder-notification');
  if (dashboardNotification) {
    dashboardNotification.style.display = 'none';
  }

  const settingsNotification = document.getElementById('backup-reminder-notification');
  if (settingsNotification) {
    settingsNotification.style.display = 'none';
  }
}

function updateLastExportDate() {
  const lastExportDate = localStorage.getItem('lastExportDate') || 'কখনো নেওয়া হয়নি';
  const dateElement = document.getElementById('last-export-date');
  if (dateElement) {
    dateElement.textContent = lastExportDate;
  }
}




