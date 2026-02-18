/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Profile                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const TIMEZONES = [
  { label: 'America/Sao_Paulo (-03:00)', value: 'America/Sao_Paulo' },
  { label: 'America/New_York (-05:00)', value: 'America/New_York' },
  { label: 'America/Chicago (-06:00)', value: 'America/Chicago' },
  { label: 'America/Denver (-07:00)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (-08:00)', value: 'America/Los_Angeles' },
  { label: 'America/Buenos_Aires (-03:00)', value: 'America/Buenos_Aires' },
  { label: 'America/Bogota (-05:00)', value: 'America/Bogota' },
  { label: 'America/Mexico_City (-06:00)', value: 'America/Mexico_City' },
  { label: 'Europe/London (+00:00)', value: 'Europe/London' },
  { label: 'Europe/Paris (+01:00)', value: 'Europe/Paris' },
  { label: 'Europe/Berlin (+01:00)', value: 'Europe/Berlin' },
  { label: 'Europe/Madrid (+01:00)', value: 'Europe/Madrid' },
  { label: 'Europe/Lisbon (+00:00)', value: 'Europe/Lisbon' },
  { label: 'Europe/Moscow (+03:00)', value: 'Europe/Moscow' },
  { label: 'Asia/Tokyo (+09:00)', value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (+08:00)', value: 'Asia/Shanghai' },
  { label: 'Asia/Dubai (+04:00)', value: 'Asia/Dubai' },
  { label: 'Asia/Kolkata (+05:30)', value: 'Asia/Kolkata' },
  { label: 'Australia/Sydney (+11:00)', value: 'Australia/Sydney' },
  { label: 'Pacific/Auckland (+13:00)', value: 'Pacific/Auckland' },
];

const PROFILE_STORAGE_LEGACY = 'reunix_profile';
const PROFILE_STORAGE_PREFIX = 'reunix_profile_';

function getProfileStorageKey(user = state.currentUser) {
  if (!user) return PROFILE_STORAGE_LEGACY;
  const keyPart = user.id || user.email || 'anon';
  return `${PROFILE_STORAGE_PREFIX}${keyPart}`;
}

function getDefaultProfile(user = state.currentUser) {
  return {
    name: (user && user.name) || 'Usuário',
    email: (user && user.email) || '',
    photo: '',
    timezone: 'America/Sao_Paulo'
  };
}

function loadProfile(user = state.currentUser) {
  const key = getProfileStorageKey(user);
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return { ...getDefaultProfile(user), ...JSON.parse(saved) };
    } catch (e) { /* ignore */ }
  }

  if (user) {
    const legacySaved = localStorage.getItem(PROFILE_STORAGE_LEGACY);
    if (legacySaved) {
      try {
        const legacyProfile = { ...getDefaultProfile(user), ...JSON.parse(legacySaved) };
        localStorage.setItem(key, JSON.stringify(legacyProfile));
        return legacyProfile;
      } catch (e) { /* ignore */ }
    }
  }

  return getDefaultProfile(user);
}

function saveProfile(profile, user = state.currentUser) {
  const key = getProfileStorageKey(user);
  localStorage.setItem(key, JSON.stringify({ ...getDefaultProfile(user), ...profile }));
}

function getUserByInitials(initials) {
  if (!initials) return null;

  const fromState = (state.users || []).find(u => u.initials === initials);
  if (fromState) return fromState;

  if (typeof getLocalUsers === 'function') {
    const fromLocal = getLocalUsers().find(u => u.initials === initials);
    if (fromLocal) return fromLocal;
  }

  if (state.currentUser && state.currentUser.initials === initials) {
    return state.currentUser;
  }

  return null;
}

function getUserDisplay(initials) {
  const user = getUserByInitials(initials);
  const profile = loadProfile(user || null);
  return {
    initials: initials || '',
    name: profile.name || (user && user.name) || initials || '',
    email: profile.email || (user && user.email) || '',
    photo: profile.photo || '',
    timezone: profile.timezone || 'America/Sao_Paulo',
    user
  };
}

function renderUserAvatar(initials, options = {}) {
  const info = getUserDisplay(initials);
  const title = options.title || info.name || initials || '';
  if (info.photo) {
    return `<span class="card-avatar has-photo" title="${esc(title)}"><img src="${esc(info.photo)}" alt="${esc(info.name || 'Perfil')}" class="card-avatar-photo"></span>`;
  }
  return `<span class="card-avatar" title="${esc(title)}">${esc(initials || '')}</span>`;
}

function applyUserAvatarToElement(el, initials, options = {}) {
  if (!el) return;
  const info = getUserDisplay(initials);
  const title = options.title || info.name || initials || '';
  el.title = title;
  if (info.photo) {
    el.classList.add('has-photo');
    el.innerHTML = `<img src="${esc(info.photo)}" alt="${esc(info.name || 'Perfil')}" class="card-avatar-photo">`;
  } else {
    el.classList.remove('has-photo');
    el.textContent = initials || '';
  }
}

function refreshSidebarAvatar() {
  const avatar = document.getElementById('sidebarAvatar');
  if (!avatar) return;

  const profile = loadProfile();
  if (profile.photo) {
    avatar.innerHTML = `<img src="${profile.photo}" alt="Perfil" class="sidebar-avatar-photo">`;
    avatar.classList.add('has-photo');
    return;
  }

  const initials =
    (state.currentUser && state.currentUser.initials) ||
    ((state.currentUser && state.currentUser.name)
      ? state.currentUser.name.slice(0, 2).toUpperCase()
      : ''); // <-- altere aqui: de 'GM' para ''
  avatar.textContent = initials || 'Usuário';
  avatar.classList.remove('has-photo');
}

function setupProfile() {
  const avatar = document.getElementById('sidebarAvatar');
  const panel = document.getElementById('profilePanel');
  const overlay = document.getElementById('profileOverlay');

  const profile = loadProfile();

  // Apply saved profile
  const nameEl = document.getElementById('profileName');
  const photoEl = document.getElementById('profilePhoto');
  const placeholderEl = document.getElementById('profilePhotoPlaceholder');
  const tzValue = document.getElementById('profileTzValue');

  if (profile.name) nameEl.textContent = profile.name;
  if (profile.photo) {
    photoEl.src = profile.photo;
    photoEl.style.display = 'block';
    if (placeholderEl) placeholderEl.style.display = 'none';
  }
  if (profile.timezone) {
    const tz = TIMEZONES.find(t => t.value === profile.timezone);
    if (tz && tzValue) tzValue.textContent = tz.label;
  }
  refreshSidebarAvatar();

  avatar.addEventListener('click', (e) => {
    if (!state.currentUser) return;
    e.stopPropagation();
    panel.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', () => {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  });

  // Editar nome
  const btnEditName = document.getElementById('btnEditName');
  if (btnEditName) {
    btnEditName.addEventListener('click', () => {
      if (!state.currentUser) return;
      if (nameEl.querySelector('input')) return;
      const oldName = nameEl.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = oldName;
      input.className = 'profile-name-input';
      nameEl.textContent = '';
      nameEl.appendChild(input);
      input.focus();
      input.select();

      const save = () => {
        const newName = input.value.trim() || oldName;
        nameEl.textContent = newName;
        const p = loadProfile();
        p.name = newName;
        saveProfile(p);

        if (state.currentUser) {
          state.currentUser.name = newName;
          const usersRef = state.users || [];
          const stateUser = usersRef.find(u => u.id === state.currentUser.id);
          if (stateUser) stateUser.name = newName;
          if (typeof setSession === 'function') setSession(state.currentUser);
        }

        if (typeof renderMeetings === 'function') renderMeetings();
        if (state.currentMeeting && typeof openMeetingDetail === 'function') {
          openMeetingDetail(state.currentMeeting);
        }
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { nameEl.textContent = oldName; }
      });
      input.addEventListener('blur', save);
    });
  }

  // Upload foto
  const photoWrap = document.getElementById('profilePhotoWrap');
  const photoInput = document.getElementById('profilePhotoInput');
  const photoOverlay = document.getElementById('profilePhotoOverlay');

  if (photoWrap && photoInput) {
    photoWrap.addEventListener('click', () => {
      if (!state.currentUser) return;
      photoInput.click();
    });
    photoInput.addEventListener('change', (e) => {
      if (!state.currentUser) return;
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        photoEl.src = dataUrl;
        photoEl.style.display = 'block';
        if (placeholderEl) placeholderEl.style.display = 'none';
        const p = loadProfile();
        p.photo = dataUrl;
        saveProfile(p);
        refreshSidebarAvatar();

        if (typeof renderMeetings === 'function') renderMeetings();
        if (state.currentMeeting && typeof openMeetingDetail === 'function') {
          openMeetingDetail(state.currentMeeting);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
  }

  // Timezone dropdown
  const tzTrigger = document.getElementById('profileTzTrigger');
  const tzDropdown = document.getElementById('profileTzDropdown');
  if (tzTrigger && tzDropdown) {
    tzDropdown.innerHTML = TIMEZONES.map(tz => {
      const sel = tz.value === profile.timezone ? 'selected' : '';
      return `<button class="profile-tz-option ${sel}" data-tz="${tz.value}">${tz.label}</button>`;
    }).join('');

    tzTrigger.addEventListener('click', (e) => {
      if (!state.currentUser) return;
      e.stopPropagation();
      tzDropdown.classList.toggle('open');
    });

    tzDropdown.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-tz]');
      if (!opt) return;
      const tz = TIMEZONES.find(t => t.value === opt.dataset.tz);
      if (!tz) return;
      tzValue.textContent = tz.label;
      tzDropdown.querySelectorAll('.profile-tz-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      tzDropdown.classList.remove('open');
      const p = loadProfile();
      p.timezone = tz.value;
      saveProfile(p);
    });

    document.addEventListener('click', (e) => {
      if (!tzDropdown.contains(e.target) && e.target !== tzTrigger) {
        tzDropdown.classList.remove('open');
      }
    });
  }
}
