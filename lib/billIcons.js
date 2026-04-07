// lib/billIcons.js
// Maps bill categories and common bill names to Feather icon names + brand colours.
// Used by BrandAvatar (vector icon fallback for bills) and RecurringForm (icon picker).

export const BILL_ICONS = [
    // Housing
    { key: 'home',          icon: 'home',          color: '#6366F1', label: 'Home / Rent'      },
    { key: 'mortgage',      icon: 'key',           color: '#8B5CF6', label: 'Mortgage'          },
    // Utilities
    { key: 'electricity',   icon: 'zap',           color: '#F59E0B', label: 'Electricity'       },
    { key: 'water',         icon: 'droplet',       color: '#38BDF8', label: 'Water'             },
    { key: 'gas',           icon: 'thermometer',   color: '#FB923C', label: 'Gas / Heating'     },
    { key: 'wifi',          icon: 'wifi',          color: '#34D399', label: 'Internet / Wi-Fi'  },
    { key: 'phone',         icon: 'phone',         color: '#4ADE80', label: 'Phone'             },
    { key: 'trash',         icon: 'trash-2',       color: '#94A3B8', label: 'Trash / Recycling' },
    // Insurance
    { key: 'health',        icon: 'heart',         color: '#F43F5E', label: 'Health Insurance'  },
    { key: 'car_insurance', icon: 'shield',        color: '#3B82F6', label: 'Car Insurance'     },
    { key: 'home_insurance',icon: 'umbrella',      color: '#A78BFA', label: 'Home Insurance'    },
    { key: 'life_insurance',icon: 'user-check',    color: '#10B981', label: 'Life Insurance'    },
    // Finance
    { key: 'loan',          icon: 'credit-card',   color: '#EF4444', label: 'Loan'              },
    { key: 'car_payment',   icon: 'truck',         color: '#64748B', label: 'Car Payment'       },
    { key: 'investment',    icon: 'trending-up',   color: '#22C55E', label: 'Investment'        },
    // Other
    { key: 'gym',           icon: 'activity',      color: '#F97316', label: 'Gym'               },
    { key: 'childcare',     icon: 'users',         color: '#EC4899', label: 'Childcare'         },
    { key: 'storage',       icon: 'archive',       color: '#78716C', label: 'Storage Unit'      },
    { key: 'parking',       icon: 'map-pin',       color: '#0EA5E9', label: 'Parking'           },
    { key: 'bill',          icon: 'file-text',     color: '#64D2FF', label: 'Other Bill'        },
  ];
  
  // Default fallback
  export const DEFAULT_BILL_ICON = BILL_ICONS[BILL_ICONS.length - 1];
  
  export function getBillIcon(key) {
    return BILL_ICONS.find(b => b.key === key) ?? DEFAULT_BILL_ICON;
  }
  
  /**
   * Infer an icon key from a bill name or category string.
   * Used when scanning email to auto-assign the right icon.
   */
  export function inferBillIconKey(text = '') {
    const t = String(text).toLowerCase();
  
    if (t.includes('rent') || t.includes('apartment') || t.includes('landlord')) return 'home';
    if (t.includes('mortgage') || t.includes('home loan')) return 'mortgage';
    if (t.includes('electric') || t.includes('electricity') || t.includes('power') || t.includes('energy') || t.includes('kwh') || t.includes('pgе') || t.includes('con ed') || t.includes('duke')) return 'electricity';
    if (t.includes('water') || t.includes('sewer') || t.includes('sewage')) return 'water';
    if (t.includes('gas') && !t.includes('gasoline') && !t.includes('gas station')) return 'gas';
    if (t.includes('internet') || t.includes('wifi') || t.includes('wi-fi') || t.includes('broadband') || t.includes('cable') || t.includes('comcast') || t.includes('xfinity') || t.includes('spectrum') || t.includes('at&t') || t.includes('verizon fios')) return 'wifi';
    if (t.includes('phone') || t.includes('mobile') || t.includes('wireless') || t.includes('cellular') || t.includes('t-mobile') || t.includes('verizon') || t.includes('sprint')) return 'phone';
    if (t.includes('trash') || t.includes('waste') || t.includes('garbage') || t.includes('recycl')) return 'trash';
    if (t.includes('health') || t.includes('medical') || t.includes('dental') || t.includes('vision') || t.includes('anthem') || t.includes('blue cross') || t.includes('cigna') || t.includes('aetna') || t.includes('kaiser')) return 'health';
    if (t.includes('car insurance') || t.includes('auto insurance') || t.includes('geico') || t.includes('state farm') || t.includes('allstate') || t.includes('progressive') || t.includes('usaa')) return 'car_insurance';
    if (t.includes('home insurance') || t.includes('renters insurance') || t.includes('homeowner')) return 'home_insurance';
    if (t.includes('life insurance') || t.includes('life policy') || t.includes('term life')) return 'life_insurance';
    if (t.includes('loan') || t.includes('personal loan') || t.includes('student loan') || t.includes('credit card')) return 'loan';
    if (t.includes('car payment') || t.includes('auto loan') || t.includes('vehicle') || t.includes('toyota') || t.includes('honda') || t.includes('ford') || t.includes('bmw') || t.includes('mercedes')) return 'car_payment';
    if (t.includes('invest') || t.includes('portfolio') || t.includes('brokerage') || t.includes('401k') || t.includes('ira')) return 'investment';
    if (t.includes('gym') || t.includes('fitness') || t.includes('planet fitness') || t.includes('equinox') || t.includes('crossfit')) return 'gym';
    if (t.includes('child') || t.includes('daycare') || t.includes('nursery') || t.includes('school fee')) return 'childcare';
    if (t.includes('storage')) return 'storage';
    if (t.includes('park') && !t.includes('park subscription')) return 'parking';
  
    return 'bill';
  }