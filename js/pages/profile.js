/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — User Profile & Academic Credentials
   Path: js/pages/profile.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────────────────────*/
function renderProfilePage() {
  const user  = STATE.user;
  const certs = getDB('vvce_certs').filter(c=>c.userId===user.id);
  const regs  = getDB('vvce_events').filter(e=>(e.registrations||[]).includes(user.id));
  const total = user.points || 0;
  const el    = document.getElementById('page-profile');

  if (user.type !== 'student') { el.innerHTML = renderAuthorityProfile(); return; }

  el.innerHTML = `
    <!-- Main profile card -->
    <div class="profile-head-card">
      <div class="prof-head-row">
        <div class="prof-avatar-wrap" onclick="triggerPhotoUpload()">
          <div class="prof-avatar">
            ${user.profilePhoto?`<img src="${user.profilePhoto}">`:`<span>${avatar(user.name)}</span>`}
          </div>
          <div class="photo-edit-overlay">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="prof-info" style="flex:1;">
          <h2>${titleCase(user.name)}</h2>
          <div class="prof-meta-row" style="color:#6b7280;">${user.usn||'—'} &nbsp;•&nbsp; ${user.branch||'—'} &nbsp;•&nbsp; ${computeStudentYearSem(user).year} &nbsp;•&nbsp; Sec ${user.section||'—'}</div>
          <div class="prof-meta-row" style="font-size:12px;color:#9ca3af;margin-top:2px;">${user.email}</div>
          ${user.bio?`<div style="font-size:13px;color:#374151;margin-top:8px;font-style:italic;line-height:1.5;">"${user.bio}"</div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
            ${(user.interests||[]).map(i=>`<span class="interest-chip selected" style="cursor:default;">${i}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-gold" onclick="openProfileEdit()" style="align-self:flex-start;white-space:nowrap;">✏️ Edit Profile</button>
      </div>
      <div class="prof-stats">
        <div class="prof-stat"><div class="val">${total}</div><div class="lbl">AICTE Points</div></div>
        <div class="prof-stat"><div class="val">${regs.length}</div><div class="lbl">Registered</div></div>
        <div class="prof-stat"><div class="val">${certs.length}</div><div class="lbl">Certificates</div></div>
        <div class="prof-stat"><div class="val">${regs.filter(e=>new Date(e.date)<new Date()).length}</div><div class="lbl">Attended</div></div>
      </div>
    </div>

    <!-- Two-col info -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
      <div class="white-card">
        <div class="sec-title" style="margin-bottom:1rem;">Academic Details</div>
        <div class="prof-grid">
          ${profField('USN',user.usn)} ${profField('Branch',user.branch)}
          ${profField('Year', computeStudentYearSem(user).year)} ${profField('Semester', computeStudentYearSem(user).sem)}
          ${profField('Section',user.section)} ${profField('Email',user.email)}
        </div>
      </div>
      <div class="white-card">
        <div class="sec-title" style="margin-bottom:1rem;">Contact & Links</div>
        <div class="prof-grid">
          ${profField('Phone',user.phone)}
          ${profFieldLink('LinkedIn',user.linkedin)}
          ${profFieldLink('GitHub',user.github)}
        </div>
        <div style="margin-top:12px;">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:6px;">Skills</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            ${(user.skills||[]).length
              ? user.skills.map(s=>`<span class="skill-chip">${s}</span>`).join('')
              : `<span style="font-size:13px;color:#9ca3af;">No skills added. <span style="color:#f59e0b;cursor:pointer;" onclick="openProfileEdit()">Add →</span></span>`
            }
          </div>
        </div>
        ${user.resume?`<div style="margin-top:10px;"><a href="${user.resume}" download style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;color:#1d4ed8;font-size:12px;font-weight:700;">📄 Download Resume</a></div>`:''}
      </div>
    </div>

    <!-- Achievements -->
    <div class="white-card" style="margin-bottom:1rem;">
      <div class="sec-head"><span class="sec-title">Achievements & Awards</span><button class="btn btn-outline" onclick="openProfileEdit()">+ Add</button></div>
      ${(user.achievements||[]).length
        ? user.achievements.map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f59e0b,#fbbf24);display:flex;align-items:center;justify-content:center;font-size:14px;">🏆</div>
            <div style="font-size:13px;font-weight:600;color:#111827;">${a}</div>
          </div>`).join('')
        : `<div style="color:#9ca3af;font-size:13px;">No achievements added. <span style="color:#f59e0b;cursor:pointer;" onclick="openProfileEdit()">Add achievements →</span></div>`
      }
    </div>

    <!-- AICTE Sem breakdown -->
    <div class="white-card">
      <div class="sec-title" style="margin-bottom:1rem;">AICTE Points — Semester Breakdown</div>
      <div class="sem-grid">
        ${Object.entries(user.pointsBySem||{}).map(([s,p])=>`<div class="sem-cell"><div class="sem-val">${p}</div><div class="sem-lbl">${s}</div></div>`).join('')}
      </div>
    </div>
  `;
}

function renderAuthorityProfile() {
  const user = STATE.user;
  const isClubAdmin = user.type === 'admin';
  const displayLogo = user.clubLogo || user.profilePhoto;
  return `
    <div class="profile-head-card">
      <div class="prof-head-row">
        <div class="prof-avatar-wrap" onclick="triggerPhotoUpload()">
          <div class="prof-avatar">${displayLogo?`<img src="${displayLogo}">`:`<span>${isClubAdmin?'🏛️':avatar(user.name)}</span>`}</div>
          <div class="photo-edit-overlay">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="prof-info" style="flex:1;">
          ${isClubAdmin ? `
            <h2 style="font-size:22px; font-weight:800; color:#111827; margin:0;">${user.clubName || 'Club Admin'}</h2>
            <div class="prof-meta-row" style="color:#4f46e5; font-weight:700; font-size:14px; margin-top:4px;">
              👤 Representative: ${titleCase(user.name)}
            </div>
            <div class="prof-meta-row" style="color:#059669; font-weight:600; font-size:13px; margin-top:2px;">
              👩‍🏫 Faculty Coordinator: ${user.faculty || '—'}
            </div>
            <div class="prof-meta-row" style="color:#6b7280; font-size:12px; margin-top:2px;">
              🏛️ ${user.domain || 'General'} Domain &nbsp;•&nbsp; ${user.dept || user.branch || '—'} Department
            </div>
          ` : `
            <h2>${titleCase(user.name)}</h2>
            <div class="prof-meta-row" style="color:#6b7280;">${titleCase(user.designation||'')} &nbsp;•&nbsp; ${user.dept||''}</div>
            <div class="prof-meta-row" style="font-size:12px;color:#9ca3af;">${user.email}</div>
          `}
        </div>
        <button class="btn btn-gold" onclick="openProfileEdit()" style="align-self:flex-start;white-space:nowrap;">✏️ Edit Profile</button>
      </div>
    </div>

    ${isClubAdmin ? `
    <!-- Club Details -->
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-head"><span class="sec-title">🏛️ Club Information</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        ${profField('Club Name', user.clubName)}
        ${profField('Domain / Category', user.domain)}
        ${profField('Department', user.dept || user.branch)}
        ${profField('Faculty Coordinator', user.faculty)}
        ${profField('Club Email', user.clubEmail)}
        ${profField('Phone', user.phone)}
      </div>
      ${user.desc ? `<div style="margin-top:12px;"><label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">About the Club</label><div style="margin-top:4px;font-size:13px;color:#374151;line-height:1.6;">${user.desc}</div></div>` : ''}
    </div>

    <!-- Personal Info -->
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-head"><span class="sec-title">👤 Representative Details</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        ${profField('Representative Name', titleCase(user.name))}
        ${profField('VVCE Email', user.email)}
        ${profField('USN', user.usn)}
        ${profField('Phone', user.phone)}
      </div>
      ${user.bio ? `<div style="margin-top:12px;"><label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Bio</label><div style="margin-top:4px;font-size:13px;color:#374151;font-style:italic;">&ldquo;${user.bio}&rdquo;</div></div>` : ''}
      ${(user.skills||[]).length ? `
        <div style="margin-top:12px;">
          <label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Skills</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${user.skills.map(s=>`<span class="skill-chip">${s}</span>`).join('')}</div>
        </div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${user.linkedin?`<a href="https://${user.linkedin}" target="_blank" class="soc-link">LinkedIn</a>`:''}
        ${user.github?`<a href="https://${user.github}" target="_blank" class="soc-link">GitHub</a>`:''}
      </div>
    </div>` : `
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-head"><span class="sec-title">👤 Profile Details</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        ${profField('Designation', titleCase(user.designation||''))}
        ${profField('Department', user.dept)}
        ${profField('Email', user.email)}
        ${profField('Phone', user.phone)}
      </div>
    </div>`}
  `;
}

function profField(label, val) { return `<div class="prof-field"><label>${label}</label><span>${val||'—'}</span></div>`; }
function profFieldLink(label, val) {
  if (!val) return profField(label,'—');
  return `<div class="prof-field"><label>${label}</label><a href="https://${val}" target="_blank" style="font-size:13px;color:#f59e0b;font-weight:600;">${val}</a></div>`;
}

function triggerPhotoUpload() { document.getElementById('photo-upload')?.click(); }
function handlePhotoUpload(input) {
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{ updateUser({profilePhoto:e.target.result}); toast('Profile photo updated! 📷','success'); renderProfilePage(); renderSidebar(); renderTopbarUser(); };
  r.readAsDataURL(file);
}

function openProfileEdit() {
  const user=STATE.user;
  const isClubAdmin = user.type === 'admin';
  const isAuthority = user.type === 'authority';

  if (isClubAdmin) {
    document.getElementById('modal-profile-body').innerHTML=`
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">🏛️ Club Information</div>
      <div class="form-row">
        <div class="form-group"><label>Club Name</label><input type="text" id="pe-clubname" value="${user.clubName||''}" placeholder="e.g. CSE Club"></div>
        <div class="form-group"><label>Domain / Category</label><input type="text" id="pe-domain" value="${user.domain||''}" placeholder="e.g. Technical"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Department</label><input type="text" id="pe-dept" value="${user.dept||user.branch||''}" placeholder="e.g. CSE"></div>
        <div class="form-group"><label>Faculty Coordinator</label><input type="text" id="pe-faculty" value="${user.faculty||''}" placeholder="Dr. / Prof. Name"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Club Email</label><input type="email" id="pe-clubemail" value="${user.clubEmail||''}" placeholder="club@vvce.ac.in"></div>
        <div class="form-group"><label>Phone</label><input type="text" id="pe-phone" value="${user.phone||''}" placeholder="+91 9876543210"></div>
      </div>
      <div class="form-group"><label>About the Club</label><textarea id="pe-desc" rows="3" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="Brief description of your club...">${user.desc||''}</textarea></div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;">
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">👤 Representative Details</div>
      <div class="form-row">
        <div class="form-group"><label>Representative Name <span style="color:#9ca3af;font-size:11px;">(account name)</span></label><input type="text" value="${titleCase(user.name)}" disabled style="background:#f9fafb;color:#9ca3af;cursor:not-allowed;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;width:100%;font-size:13px;"></div>
        <div class="form-group"><label>VVCE Email <span style="color:#9ca3af;font-size:11px;">(cannot change)</span></label><input type="email" value="${user.email}" disabled style="background:#f9fafb;color:#9ca3af;cursor:not-allowed;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;width:100%;font-size:13px;"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>USN</label><input type="text" id="pe-usn" value="${user.usn||''}" placeholder="e.g. 4VV22CS001"></div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  } else if (isAuthority) {
    document.getElementById('modal-profile-body').innerHTML=`
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">🎓 Faculty Details</div>
      <div class="form-row">
        <div class="form-group"><label>Full Name <span style="color:#9ca3af;font-size:11px;">(Dr. / Prof. Name)</span></label><input type="text" id="pe-name" value="${user.name||''}" placeholder="e.g. Dr. John Doe"></div>
        <div class="form-group"><label>Designation <span style="color:#9ca3af;font-size:11px;">(e.g. Faculty, Dean)</span></label><input type="text" id="pe-designation" value="${user.designation||''}" placeholder="e.g. Faculty"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>VVCE Email</label><input type="email" id="pe-email" value="${user.email||''}" placeholder="faculty@vvce.ac.in"></div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  } else {
    document.getElementById('modal-profile-body').innerHTML=`
      <div class="form-row">
        <div class="form-group"><label>Phone Number</label><input type="text" id="pe-phone" value="${user.phone||''}" placeholder="9876543210"></div>
        <div class="form-group"><label>LinkedIn URL</label><input type="text" id="pe-linkedin" value="${user.linkedin||''}" placeholder="linkedin.com/in/yourname"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>GitHub URL</label><input type="text" id="pe-github" value="${user.github||''}" placeholder="github.com/yourname"></div>
        <div class="form-group"><label>Skills (comma-separated)</label><input type="text" id="pe-skills" value="${(user.skills||[]).join(', ')}" placeholder="Python, React, Node.js"></div>
      </div>
      <div class="form-group"><label>Bio / About Me</label><textarea id="pe-bio" rows="3" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="Write a short bio...">${user.bio||''}</textarea></div>
      <div class="form-group"><label>Achievements (one per line)</label><textarea id="pe-achievements" rows="4" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="e.g. Hackathon Winner 2024">${(user.achievements||[]).join('\n')}</textarea></div>
      <div class="form-group">
        <label>Interests</label>
        <div class="interest-grid" id="pe-interests">
          ${['Technical','Cultural','Sports','Management','Workshop','Social'].map(i=>`<span class="interest-chip ${(user.interests||[]).includes(i)?'selected':''}" onclick="toggleChip(this)">${i}</span>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Resume Upload</label>
        <div class="upload-zone" onclick="document.getElementById('resume-upload').click()">
          <div class="upload-icon">📄</div>
          <p>${user.resume?'Resume uploaded — click to replace':'Click to upload your resume (PDF)'}</p>
          <input type="file" id="resume-upload" style="display:none;" accept=".pdf,.doc,.docx" onchange="handleResumeUpload(this)">
        </div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  }
  openModal('modal-profile-edit');
}

function saveProfileEdit() {
  const isClubAdmin = STATE.user.type === 'admin';
  const isAuthority = STATE.user.type === 'authority';
  const updates = {};
  
  if (isAuthority) {
    updates.name = document.getElementById('pe-name')?.value.trim();
    updates.designation = document.getElementById('pe-designation')?.value.trim();
    updates.email = document.getElementById('pe-email')?.value.trim();
  } else {
    updates.phone = document.getElementById('pe-phone')?.value.trim();
    updates.linkedin = document.getElementById('pe-linkedin')?.value.trim();
    updates.github = document.getElementById('pe-github')?.value.trim();
    updates.skills = document.getElementById('pe-skills')?.value.split(',').map(s=>s.trim()).filter(Boolean);
    updates.bio = document.getElementById('pe-bio')?.value.trim();
  }

  if (isClubAdmin) {
    updates.clubName  = document.getElementById('pe-clubname')?.value.trim();
    updates.domain    = document.getElementById('pe-domain')?.value.trim();
    updates.dept      = document.getElementById('pe-dept')?.value.trim();
    updates.faculty   = document.getElementById('pe-faculty')?.value.trim();
    updates.clubEmail = document.getElementById('pe-clubemail')?.value.trim();
    updates.desc      = document.getElementById('pe-desc')?.value.trim();
    updates.usn       = document.getElementById('pe-usn')?.value.trim();
  } else if (!isAuthority) {
    const achEl = document.getElementById('pe-achievements');
    if (achEl) updates.achievements = achEl.value.split('\n').map(s=>s.trim()).filter(Boolean);
    updates.interests = [...document.querySelectorAll('#pe-interests .interest-chip.selected')].map(c=>c.textContent.trim());
  }

  updateUser(updates);
  closeModal('modal-profile-edit');
  toast('Profile updated! ✅','success');
  renderProfilePage();
  renderSidebar();
}

function handleResumeUpload(input) {
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{ updateUser({resume:e.target.result}); toast('Resume uploaded! 📄','success'); };
  r.readAsDataURL(file);
}

function updateUser(updates) {
  const users=getDB('vvce_users');
  const idx=users.findIndex(u=>u.id===STATE.user.id);
  if(idx>-1){ Object.assign(users[idx],updates); setDB('vvce_users',users); STATE.user=users[idx]; }
}

