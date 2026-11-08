const fs = require('fs');
const path = require('path');
const cpmPath = path.join(__dirname, 'cpm.html');
let html = fs.readFileSync(cpmPath, 'utf8');

// 1. Add Navigation Button
const navBtn = `      <button class="tab-btn" id="nav-authorities" onclick="switchTab('authorities', this)">🏛️ Approving Authorities</button>`;
html = html.replace(
  '<button class="tab-btn" id="nav-emergency"',
  navBtn + '\n      <button class="tab-btn" id="nav-emergency"'
);

// 2. Add Tab Content section inside <main>
const authoritiesTabContent = `
    <!-- APPROVING AUTHORITIES TAB -->
    <section id="tab-authorities" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-family:'Outfit'; font-weight:800; color:#0f172a; margin:0; font-size:1.6rem;">Approving Authorities Management</h2>
          <p style="color:#64748b; margin:4px 0 0; font-size:0.9rem;">Configure institutional approving authorities, reset credentials, and control review queues.</p>
        </div>
        <button type="button" class="btn btn-primary" onclick="openAddAuthorityModal()" style="display:flex; align-items:center; gap:8px;">
          <span>➕</span> Add Approving Authority
        </button>
      </div>

      <!-- Authorities List Card -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.5rem; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="font-size:1.1rem; color:#1e293b; font-weight:700; margin:0;">Configured Authorities</h3>
          <span id="authority-count-badge" class="badge" style="background:#f1f5f9; color:#475569; font-size:12px; font-weight:700;">0 authorities</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="text-align:left; border-bottom:2px solid #f1f5f9; font-size:12px; color:#64748b; text-transform:uppercase;">
                <th style="padding:10px 12px;">Authority Name</th>
                <th style="padding:10px 12px;">Designation / Email</th>
                <th style="padding:10px 12px;">Status</th>
                <th style="padding:10px 12px;">Created</th>
                <th style="padding:10px 12px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="authorities-table-body">
              <tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Loading authorities...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
`;

html = html.replace('  </main>', authoritiesTabContent + '  </main>');

// 3. Add Modals before <div id="toast">
const modalsHtml = `
  <!-- Add Approving Authority Modal -->
  <div id="add-authority-modal" class="modal-overlay" style="position:fixed; inset:0; background:rgba(15, 23, 42, 0.6); backdrop-filter:blur(6px); display:none; align-items:center; justify-content:center; z-index:600; padding:1rem;">
    <div class="modal-box" style="max-width: 500px; background:#ffffff; padding:2rem; border-radius:18px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <h3 style="color:#0f172a; margin:0; font-family:'Outfit'; font-weight:800; font-size:1.3rem;">➕ Add Approving Authority</h3>
        <button type="button" onclick="closeAddAuthorityModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;">✕</button>
      </div>
      <form id="add-authority-form" onsubmit="handleCreateAuthority(event)">
        <div class="form-group" style="margin-bottom:1rem;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Approving Authority Name *</label>
          <input type="text" id="new-auth-name" class="form-control" placeholder="e.g. Dean Student Welfare, HOD CSE" required style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px;">
        </div>
        <div class="form-group" style="margin-bottom:1rem;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Official Email (Optional)</label>
          <input type="email" id="new-auth-email" class="form-control" placeholder="e.g. dean.sw@vvce.ac.in" style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px;">
        </div>
        <div class="form-group" style="margin-bottom:1rem;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Password *</label>
          <div style="position:relative;">
            <input type="password" id="new-auth-pass" class="form-control" placeholder="Enter password (min 6 chars)" required minlength="6" style="width:100%; padding:10px 40px 10px 12px; border:1px solid #cbd5e1; border-radius:8px;">
            <button type="button" onclick="togglePassVisibility('new-auth-pass', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748b;">👁️</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:1.5rem;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Confirm Password *</label>
          <div style="position:relative;">
            <input type="password" id="new-auth-pass-confirm" class="form-control" placeholder="Re-enter password" required minlength="6" style="width:100%; padding:10px 40px 10px 12px; border:1px solid #cbd5e1; border-radius:8px;">
            <button type="button" onclick="togglePassVisibility('new-auth-pass-confirm', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748b;">👁️</button>
          </div>
        </div>
        <div id="add-auth-error" style="display:none; color:#dc2626; font-size:12px; margin-bottom:1rem; padding:8px 12px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn" style="background:#e2e8f0; color:#334155;" onclick="closeAddAuthorityModal()">Cancel</button>
          <button type="submit" id="submit-new-auth-btn" class="btn btn-primary">Confirm & Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Change Password Modal -->
  <div id="change-auth-pass-modal" class="modal-overlay" style="position:fixed; inset:0; background:rgba(15, 23, 42, 0.6); backdrop-filter:blur(6px); display:none; align-items:center; justify-content:center; z-index:600; padding:1rem;">
    <div class="modal-box" style="max-width: 460px; background:#ffffff; padding:2rem; border-radius:18px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <h3 style="color:#0f172a; margin:0; font-family:'Outfit'; font-weight:800; font-size:1.2rem;">🔑 Change Authority Password</h3>
        <button type="button" onclick="closeChangeAuthPassModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;">✕</button>
      </div>
      <form id="change-auth-pass-form" onsubmit="handleChangeAuthorityPassword(event)">
        <input type="hidden" id="change-auth-id">
        <p style="font-size:13px; color:#475569; margin-bottom:1rem;">Updating password for <strong id="change-auth-name-display" style="color:#0f172a;"></strong></p>
        <div class="form-group" style="margin-bottom:1rem;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">New Password *</label>
          <div style="position:relative;">
            <input type="password" id="change-auth-pass" class="form-control" placeholder="Enter new password (min 6 chars)" required minlength="6" style="width:100%; padding:10px 40px 10px 12px; border:1px solid #cbd5e1; border-radius:8px;">
            <button type="button" onclick="togglePassVisibility('change-auth-pass', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748b;">👁️</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:1.5rem;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Confirm New Password *</label>
          <div style="position:relative;">
            <input type="password" id="change-auth-pass-confirm" class="form-control" placeholder="Re-enter new password" required minlength="6" style="width:100%; padding:10px 40px 10px 12px; border:1px solid #cbd5e1; border-radius:8px;">
            <button type="button" onclick="togglePassVisibility('change-auth-pass-confirm', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748b;">👁️</button>
          </div>
        </div>
        <div id="change-auth-error" style="display:none; color:#dc2626; font-size:12px; margin-bottom:1rem; padding:8px 12px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn" style="background:#e2e8f0; color:#334155;" onclick="closeChangeAuthPassModal()">Cancel</button>
          <button type="submit" id="submit-change-pass-btn" class="btn btn-primary">Update Password</button>
        </div>
      </form>
    </div>
  </div>
`;

html = html.replace('  <div id="toast">', modalsHtml + '\n  <div id="toast">');

// 4. Update switchTab to load authorities when opening tab-authorities
html = html.replace(
  "if (tab === 'audit') loadAuditLog();",
  "if (tab === 'audit') loadAuditLog();\n      if (tab === 'authorities') loadAuthorities();"
);

// 5. Update showDashboard to loadAuthorities()
html = html.replace(
  'loadAuditLog();',
  'loadAuditLog();\n      loadAuthorities();'
);

// 6. Update applyRolePermissions to handle nav-authorities
html = html.replace(
  "emergency: document.getElementById('nav-emergency')",
  "emergency: document.getElementById('nav-emergency'),\n        authorities: document.getElementById('nav-authorities')"
);

// 7. Append the JavaScript logic before </script>
const cpmAuthScript = `
    /* ========================================================================
       APPROVING AUTHORITIES MANAGEMENT (CPM)
       ======================================================================== */
    let cachedAuthorities = [];

    // Salted PBKDF2 Password Hashing
    async function hashPasswordWithSalt(password, saltStr) {
      const enc = new TextEncoder();
      const salt = enc.encode(saltStr || ('salt_' + Math.random().toString(36).substring(2, 10)));
      const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      );
      const hashArray = Array.from(new Uint8Array(derivedBits));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return { hash: hashHex, salt: new TextDecoder().decode(salt) };
    }

    function togglePassVisibility(inputId, btn) {
      const el = document.getElementById(inputId);
      if (!el) return;
      if (el.type === 'password') {
        el.type = 'text';
        btn.textContent = '🙈';
      } else {
        el.type = 'password';
        btn.textContent = '👁️';
      }
    }

    function openAddAuthorityModal() {
      document.getElementById('new-auth-name').value = '';
      document.getElementById('new-auth-email').value = '';
      document.getElementById('new-auth-pass').value = '';
      document.getElementById('new-auth-pass-confirm').value = '';
      document.getElementById('add-auth-error').style.display = 'none';
      document.getElementById('add-authority-modal').style.display = 'flex';
    }

    function closeAddAuthorityModal() {
      document.getElementById('add-authority-modal').style.display = 'none';
    }

    function openChangeAuthPassModal(id, name) {
      document.getElementById('change-auth-id').value = id;
      document.getElementById('change-auth-name-display').textContent = name;
      document.getElementById('change-auth-pass').value = '';
      document.getElementById('change-auth-pass-confirm').value = '';
      document.getElementById('change-auth-error').style.display = 'none';
      document.getElementById('change-auth-pass-modal').style.display = 'flex';
    }

    function closeChangeAuthPassModal() {
      document.getElementById('change-auth-pass-modal').style.display = 'none';
    }

    async function loadAuthorities() {
      try {
        const { data, error } = await sb.from('approving_authorities').select('*').order('created_at', { ascending: true });
        if (error) {
          console.warn('Could not fetch from approving_authorities table, falling back to local storage cache:', error);
          const raw = localStorage.getItem('vvce_approving_authorities');
          cachedAuthorities = raw ? JSON.parse(raw) : getInitialDefaultAuthorities();
        } else {
          cachedAuthorities = Array.isArray(data) && data.length ? data : getInitialDefaultAuthorities();
          localStorage.setItem('vvce_approving_authorities', JSON.stringify(cachedAuthorities));
        }
      } catch (err) {
        console.warn('loadAuthorities error:', err);
        const raw = localStorage.getItem('vvce_approving_authorities');
        cachedAuthorities = raw ? JSON.parse(raw) : getInitialDefaultAuthorities();
      }
      renderAuthoritiesTable();
    }

    function getInitialDefaultAuthorities() {
      return [
        {
          id: 'auth_dean_sw',
          name: 'Dean Student Welfare',
          email: 'dean.sw@vvce.ac.in',
          designation: 'Dean Student Welfare',
          password_hash: 'b6fdb537e29bb3ff3ce1b00e66eb139a039750bca80ca60d69611894d3ec8595',
          salt: 'vvce_salt_dean_2026',
          active: true,
          created_at: new Date().toISOString()
        }
      ];
    }

    function renderAuthoritiesTable() {
      const tbody = document.getElementById('authorities-table-body');
      const countBadge = document.getElementById('authority-count-badge');
      if (!tbody) return;
      if (countBadge) countBadge.textContent = cachedAuthorities.length + ' authorities';

      if (!cachedAuthorities.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No approving authorities configured yet. Click "Add Approving Authority" to create one.</td></tr>';
        return;
      }

      tbody.innerHTML = cachedAuthorities.map(a => {
        const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString() : 'N/A';
        return \`
          <tr style="border-bottom:1px solid #f1f5f9; font-size:13px; color:#334155;">
            <td style="padding:12px;">
              <strong style="color:#0f172a; font-size:14px;">\${a.name}</strong>
            </td>
            <td style="padding:12px;">
              <div>\${a.designation || 'Approving Authority'}</div>
              <div style="font-size:11px; color:#64748b;">\${a.email || 'No email specified'}</div>
            </td>
            <td style="padding:12px;">
              <span class="badge" style="background:\${a.active ? '#f0fdf4' : '#fef2f2'}; color:\${a.active ? '#15803d' : '#b91c1c'}; border:1px solid \${a.active ? '#bbf7d0' : '#fecaca'};">
                \${a.active ? '● Active' : '○ Deactivated'}
              </span>
            </td>
            <td style="padding:12px; font-size:12px; color:#64748b;">\${dateStr}</td>
            <td style="padding:12px; text-align:right;">
              <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="btn btn-sm" style="background:#f1f5f9; color:#334155;" onclick="openChangeAuthPassModal('\${a.id}', '\${a.name.replace(/'/g, "\\\\'")}')" title="Change Password">
                  🔑 Password
                </button>
                <button type="button" class="btn btn-sm \${a.active ? 'btn-danger' : 'btn-success'}" onclick="toggleAuthorityActive('\${a.id}', \${!a.active})" style="padding:4px 8px; font-size:11px;">
                  \${a.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }

    async function handleCreateAuthority(e) {
      e.preventDefault();
      const errEl = document.getElementById('add-auth-error');
      errEl.style.display = 'none';

      const name = document.getElementById('new-auth-name').value.trim();
      const email = document.getElementById('new-auth-email').value.trim();
      const pass = document.getElementById('new-auth-pass').value;
      const confirmPass = document.getElementById('new-auth-pass-confirm').value;

      if (!name) {
        errEl.textContent = 'Please enter an authority name.';
        errEl.style.display = 'block';
        return;
      }

      if (pass !== confirmPass) {
        errEl.textContent = 'Passwords do not match.';
        errEl.style.display = 'block';
        return;
      }

      if (pass.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        errEl.style.display = 'block';
        return;
      }

      // Case-insensitive duplicate name check
      const duplicate = cachedAuthorities.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        errEl.textContent = 'An authority with this name already exists (case-insensitive).';
        errEl.style.display = 'block';
        return;
      }

      const submitBtn = document.getElementById('submit-new-auth-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        const salt = 'salt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const { hash } = await hashPasswordWithSalt(pass, salt);

        const newAuth = {
          id: 'auth_' + Date.now(),
          name,
          email: email || null,
          designation: 'Approving Authority',
          password_hash: hash,
          salt: salt,
          active: true,
          created_at: new Date().toISOString()
        };

        // Save to Supabase
        const { error } = await sb.from('approving_authorities').insert([newAuth]);
        if (error) {
          console.warn('Could not insert to Supabase approving_authorities, saving locally:', error);
        }

        cachedAuthorities.push(newAuth);
        localStorage.setItem('vvce_approving_authorities', JSON.stringify(cachedAuthorities));

        if (typeof recordAuditAction === 'function') {
          await recordAuditAction({
            action: 'Authority Created',
            target: newAuth.id,
            details: 'Created approving authority: ' + name
          });
        }

        closeAddAuthorityModal();
        renderAuthoritiesTable();
        showToast('Approving Authority "' + name + '" created successfully! Live across all portals.');
      } catch (err) {
        console.error('Error creating authority:', err);
        errEl.textContent = err.message || 'Failed to create authority.';
        errEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm & Create';
      }
    }

    async function handleChangeAuthorityPassword(e) {
      e.preventDefault();
      const errEl = document.getElementById('change-auth-error');
      errEl.style.display = 'none';

      const id = document.getElementById('change-auth-id').value;
      const pass = document.getElementById('change-auth-pass').value;
      const confirmPass = document.getElementById('change-auth-pass-confirm').value;

      if (pass !== confirmPass) {
        errEl.textContent = 'Passwords do not match.';
        errEl.style.display = 'block';
        return;
      }

      if (pass.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        errEl.style.display = 'block';
        return;
      }

      const submitBtn = document.getElementById('submit-change-pass-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      try {
        const salt = 'salt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const { hash } = await hashPasswordWithSalt(pass, salt);

        // Update in Supabase
        await sb.from('approving_authorities').update({
          password_hash: hash,
          salt: salt,
          updated_at: new Date().toISOString()
        }).eq('id', id);

        const target = cachedAuthorities.find(a => a.id === id);
        if (target) {
          target.password_hash = hash;
          target.salt = salt;
          target.updated_at = new Date().toISOString();
        }
        localStorage.setItem('vvce_approving_authorities', JSON.stringify(cachedAuthorities));

        if (typeof recordAuditAction === 'function') {
          await recordAuditAction({
            action: 'Authority Password Changed',
            target: id,
            details: 'Updated password for authority: ' + (target ? target.name : id)
          });
        }

        closeChangeAuthPassModal();
        showToast('Password updated successfully!');
      } catch (err) {
        console.error('Error updating password:', err);
        errEl.textContent = err.message || 'Failed to update password.';
        errEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
      }
    }

    async function toggleAuthorityActive(id, newStatus) {
      const target = cachedAuthorities.find(a => a.id === id);
      const actionName = newStatus ? 'Activate' : 'Deactivate';
      if (!confirm(actionName + ' approving authority "' + (target ? target.name : id) + '"? Historical records will be preserved.')) return;

      try {
        await sb.from('approving_authorities').update({ active: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
        if (target) target.active = newStatus;
        localStorage.setItem('vvce_approving_authorities', JSON.stringify(cachedAuthorities));

        if (typeof recordAuditAction === 'function') {
          await recordAuditAction({
            action: 'Authority ' + actionName + 'd',
            target: id,
            details: actionName + 'd authority: ' + (target ? target.name : id)
          });
        }

        renderAuthoritiesTable();
        showToast('Authority status updated successfully.');
      } catch (err) {
        console.error('Failed to toggle authority status:', err);
        alert('Failed to update authority status.');
      }
    }
`;

html = html.replace('  </script>', cpmAuthScript + '\n  </script>');

fs.writeFileSync(cpmPath, html, 'utf8');
console.log('Clean cpm.html written with proper script tags. Length:', html.length);
