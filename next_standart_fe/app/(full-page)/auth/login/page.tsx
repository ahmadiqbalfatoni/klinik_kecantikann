'use client';

import { useFormik } from 'formik';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { showError, showSuccess, showWarning } from '../../../../lib/tools/generalTools';
import { signIn } from 'next-auth/react';
import { Toast } from 'primereact/toast';
import axios from 'axios';
import { LoginFormik, LoginState } from './component/interfaces';

export default function LoginPage() {
  const router = useRouter();
  const toast = useRef<Toast>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<LoginState>({
    load: false,
    googleLoad: false,
  });

  const formik = useFormik<LoginFormik>({
    initialValues: {
      username: '',
      password: '',
      remember_me: true,
    },
    validate: (data: LoginFormik) => {
      const errors = {} as Record<keyof LoginFormik, string>;
      if (!data.username) {
        errors.username = 'Username wajib diisi';
      }
      if (!data.password) {
        errors.password = 'Password wajib diisi';
      }
      return errors;
    },
    onSubmit: (data) => {
      handleSubmit(data);
    },
  });

  const handleSubmit = async (data: LoginFormik) => {
    setState((p) => ({ ...p, load: true }));
    try {
      const { data: vaLogin } = await axios.post('/api/auth/login', {
        username: data.username,
        password: data.password,
        remember_me: data.remember_me ? '1' : '0',
      });

      const nAuth = await signIn('credentials', {
        userData: JSON.stringify(vaLogin.data),
        redirect: false,
      });

      if (nAuth?.error) {
        showError(toast, 'Username atau kata sandi tidak sesuai.');
      } else {
        showSuccess(toast, 'Login Berhasil! Mengalihkan ke Dashboard...');
        setTimeout(() => router.push('/dashboard'), 400);
      }
    } catch (error: any) {
      const e = error?.response?.data || error;
      showError(toast, e.message || 'Gagal masuk ke sistem, periksa kembali username dan password Anda');
    } finally {
      setState((p) => ({ ...p, load: false }));
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    showWarning(
      toast,
      'Lupa kata sandi? Silakan hubungi Administrator IT atau Super Admin klinik untuk mereset kata sandi akun Anda.'
    );
  };

  return (
    <>
      <Toast ref={toast} position="top-right" />

      {/* Google Fonts & Material Symbols */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <style>{`
        /* Reset & Fixed Natural Canvas (No Scroll) */
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          width: 100%;
          height: 100vh;
          max-height: 100vh;
          overflow: hidden;
          background-color: #ecfdf5;
        }

        .kk-page-wrapper {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: radial-gradient(120% 120% at 50% 10%, #f0fdf4 0%, #d1fae5 100%);
          color: #0d1f18;
          width: 100vw;
          height: 100vh;
          max-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 24px;
          position: relative;
        }

        .font-serif-display {
          font-family: 'Playfair Display', Georgia, serif;
        }

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined', sans-serif;
          font-weight: normal;
          font-style: normal;
          font-size: 18px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          -webkit-font-smoothing: antialiased;
        }

        .material-symbols-filled {
          font-variation-settings: 'FILL' 1;
        }

        /* ── MAIN CONTAINER & GRID ── */
        .kk-container {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
        }

        .kk-grid {
          display: grid;
          grid-template-columns: 1.34fr 1fr;
          gap: 24px;
          align-items: stretch;
          max-height: 94vh;
        }

        @media (max-width: 960px) {
          html, body, .kk-page-wrapper {
            height: auto;
            max-height: none;
            overflow-y: auto;
          }
          .kk-grid {
            grid-template-columns: 1fr;
            max-height: none;
          }
        }

        /* ── LEFT SHOWCASE PANEL (Aesthetic Medical & Dermatology Showcase) ── */
        .kk-left-card {
          background: 
            linear-gradient(165deg, rgba(6, 78, 59, 0.92) 0%, rgba(6, 95, 70, 0.82) 45%, rgba(4, 120, 87, 0.94) 100%),
            url('/layout/images/login-hero.jpg') center/cover no-repeat;
          border-radius: 26px;
          border: 1px solid rgba(52, 211, 153, 0.3);
          box-shadow: 0 20px 50px rgba(6, 78, 59, 0.28);
          position: relative;
          overflow: hidden;
          padding: 28px 30px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .kk-glow-top {
          position: absolute;
          right: -50px;
          top: -50px;
          width: 240px;
          height: 240px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(52, 211, 153, 0.28) 0%, transparent 70%);
          filter: blur(40px);
          pointer-events: none;
        }

        .kk-glow-bottom {
          position: absolute;
          left: -50px;
          bottom: -30px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.24) 0%, transparent 70%);
          filter: blur(40px);
          pointer-events: none;
        }

        .kk-tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          margin-bottom: 10px;
        }

        .kk-pulsing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 8px #34d399;
          animation: pulseAnim 2s infinite ease-in-out;
        }

        @keyframes pulseAnim {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.85); opacity: 0.45; }
        }

        .kk-tag-text {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.2px;
          color: #a7f3d0;
          text-transform: uppercase;
        }

        .kk-headline {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(22px, 2.2vw, 28px);
          font-weight: 700;
          color: #ffffff;
          line-height: 1.22;
          margin: 0 0 8px 0;
          letter-spacing: -0.3px;
        }

        .kk-headline-highlight {
          color: #6ee7b7;
          font-style: italic;
          font-weight: 600;
        }

        .kk-lead-desc {
          font-size: 11.5px;
          color: rgba(209, 250, 229, 0.9);
          line-height: 1.5;
          margin: 0 0 14px 0;
        }

        /* Feature List (3 Sleek Frosted Glass Cards) */
        .kk-feature-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0 0 12px 0;
          position: relative;
          z-index: 10;
        }

        .kk-feature-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 13px;
          padding: 9px 13px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          transition: all 0.25s ease;
        }

        .kk-feature-card:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(110, 231, 183, 0.35);
          transform: translateY(-2px);
        }

        .kk-feature-icon-box {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.2) 100%);
          border: 1px solid rgba(52, 211, 153, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a7f3d0;
          flex-shrink: 0;
        }

        .kk-feature-title {
          font-size: 12px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 2px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kk-feature-pill {
          font-size: 8.5px;
          font-weight: 700;
          padding: 1.5px 5px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.25);
          color: #6ee7b7;
          border: 1px solid rgba(52, 211, 153, 0.3);
        }

        .kk-feature-sub {
          font-size: 10.5px;
          color: rgba(229, 231, 235, 0.85);
          margin: 0;
          line-height: 1.35;
        }

        /* Bottom Trust & Rating Strip */
        .kk-trust-strip {
          background: rgba(0, 0, 0, 0.26);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 13px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          position: relative;
          z-index: 10;
        }

        .kk-trust-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .kk-rating-badge {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .kk-stars-row {
          display: flex;
          color: #fbbf24;
          font-size: 13px;
          gap: 1px;
        }

        .kk-rating-num {
          font-size: 12.5px;
          font-weight: 800;
          color: #ffffff;
        }

        .kk-rating-label {
          font-size: 10.5px;
          color: rgba(209, 250, 229, 0.85);
        }

        .kk-trust-pills {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .kk-trust-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2.5px 7px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          font-size: 9.5px;
          font-weight: 600;
          color: #e6fffa;
        }

        .kk-trust-quote {
          font-size: 10px;
          font-style: italic;
          color: rgba(209, 250, 229, 0.8);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 5px;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ── RIGHT AUTHENTICATION PANEL (Clean Natural Form) ── */
        .kk-right-card {
          background: #ffffff;
          border-radius: 26px;
          padding: 34px 34px;
          box-shadow: 0 16px 40px rgba(6, 78, 59, 0.08);
          border: 1px solid rgba(167, 243, 208, 0.6);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .kk-auth-brand-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 16px;
        }

        .kk-auth-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 5px 16px rgba(16, 185, 129, 0.25);
          margin-bottom: 9px;
        }

        .kk-auth-portal-title {
          font-size: 18px;
          font-weight: 700;
          color: #10b981;
          letter-spacing: -0.2px;
        }

        .kk-auth-portal-sub {
          font-size: 10.5px;
          font-weight: 700;
          color: #404944;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .kk-auth-welcome {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          color: #0d1f18;
          text-align: center;
          margin: 0 0 3px 0;
        }

        .kk-auth-welcome-sub {
          font-size: 12.5px;
          color: #404944;
          text-align: center;
          margin: 0 0 18px 0;
        }

        .kk-form-group {
          margin-bottom: 14px;
          text-align: left;
        }

        .kk-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #0d1f18;
          margin-bottom: 5px;
        }

        .kk-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .kk-input-icon {
          position: absolute;
          left: 13px;
          color: #10b981;
          pointer-events: none;
          font-size: 19px;
        }

        .kk-input {
          width: 100%;
          height: 44px;
          padding-left: 40px;
          padding-right: 14px;
          background: #f0fdf4;
          border: 1px solid #d1fae5;
          border-radius: 11px;
          font-size: 13.5px;
          font-family: inherit;
          color: #0d1f18;
          outline: none;
          transition: all 0.2s ease;
        }

        .kk-input.has-eye {
          padding-right: 40px;
        }

        .kk-input:focus {
          background: #ffffff;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
        }

        .kk-input::placeholder {
          color: #707973;
        }

        .kk-eye-btn {
          position: absolute;
          right: 9px;
          background: none;
          border: none;
          cursor: pointer;
          color: #707973;
          padding: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: color 0.2s;
        }

        .kk-eye-btn:hover {
          color: #10b981;
        }

        .kk-error-msg {
          font-size: 11.5px;
          color: #ba1a1a;
          margin-top: 4px;
          font-weight: 500;
        }

        .kk-form-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 10px 0 18px 0;
        }

        .kk-remember-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 12.5px;
          color: #0d1f18;
          user-select: none;
        }

        .kk-remember-checkbox {
          width: 15px;
          height: 15px;
          accent-color: #10b981;
          cursor: pointer;
        }

        .kk-forgot-link {
          font-size: 12px;
          font-weight: 600;
          color: #059669;
          text-decoration: none;
          cursor: pointer;
        }

        .kk-forgot-link:hover {
          color: #047857;
          text-decoration: underline;
        }

        .kk-submit-btn {
          width: 100%;
          height: 44px;
          border-radius: 999px;
          background: #10b981;
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 700;
          font-family: inherit;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
          transition: all 0.2s ease;
        }

        .kk-submit-btn:hover {
          background: #059669;
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.35);
          transform: translateY(-1px);
        }

        .kk-submit-btn:active {
          transform: translateY(0);
        }

        .kk-submit-btn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>

      <div className="kk-page-wrapper">
        <div className="kk-container">
          <div className="kk-grid">
            {/* ── LEFT COLUMN: Showcase & Stacked Floating Cards ── */}
            <div className="kk-left-card">
              {/* Background Ambient Glows */}
              <div className="kk-glow-top"></div>
              <div className="kk-glow-bottom"></div>

              {/* Top Brand Tag & Headline */}
              <div style={{ position: 'relative', zIndex: 10 }}>
                <div className="kk-tag-pill">
                  <span className="kk-pulsing-dot"></span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#6ee7b7' }}>spa</span>
                  <span className="kk-tag-text">KLINIK KECANTIKAN &amp; ESTETIKA</span>
                </div>

                <h1 className="kk-headline">
                  Pancarkan Pesona Alami <br />
                  <span className="kk-headline-highlight">Kulit Sehat &amp; Bersinar</span>
                </h1>
                <p className="kk-lead-desc">
                  Pelayanan dermatologi profesional berstandar medis dengan teknologi terkini dan sentuhan perawatan personal.
                </p>
              </div>

              {/* 3 Luxury Feature Glass Cards */}
              <div className="kk-feature-list">
                {/* Feature 1 */}
                <div className="kk-feature-card">
                  <div className="kk-feature-icon-box">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      stethoscope
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kk-feature-title">
                      <span>Dokter Spesialis Kulit</span>
                      <span className="kk-feature-pill">Sp.D.V.E</span>
                    </div>
                    <p className="kk-feature-sub">
                      Konsultasi mendalam &amp; diagnosa akurat langsung oleh dokter spesialis berpengalaman.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="kk-feature-card">
                  <div className="kk-feature-icon-box">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      auto_awesome
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kk-feature-title">
                      <span>Teknologi Laser &amp; Facial Medis</span>
                      <span className="kk-feature-pill">FDA Approved</span>
                    </div>
                    <p className="kk-feature-sub">
                      Treatment peremajaan kulit modern, higienis, steril, dan minim downtime.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="kk-feature-card">
                  <div className="kk-feature-icon-box">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      verified
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kk-feature-title">
                      <span>Skincare Teruji Klinis</span>
                      <span className="kk-feature-pill">BPOM &amp; Halal</span>
                    </div>
                    <p className="kk-feature-sub">
                      Formulasi bahan aktif medis yang aman dan teruji klinis untuk hasil kulit jangka panjang.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Trust & Accreditation Strip */}
              <div className="kk-trust-strip">
                <div className="kk-trust-main">
                  <div className="kk-rating-badge">
                    <div className="kk-stars-row">
                      ★ ★ ★ ★ ★
                    </div>
                    <div>
                      <span className="kk-rating-num">4.9 / 5.0</span>
                      <span className="kk-rating-label"> (10.000+ Pasien Percaya)</span>
                    </div>
                  </div>

                  <div className="kk-trust-pills">
                    <div className="kk-trust-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#6ee7b7' }}>
                        verified_user
                      </span>
                      <span>Standar Medis RS</span>
                    </div>
                    <div className="kk-trust-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#6ee7b7' }}>
                        sanitizer
                      </span>
                      <span>Higienis &amp; Steril</span>
                    </div>
                  </div>
                </div>

                <p className="kk-trust-quote">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#6ee7b7' }}>
                    favorite
                  </span>
                  Dedikasi profesional untuk kecantikan kulit yang sehat, alami, dan percaya diri.
                </p>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Authentication Form (Clean & Focused) ── */}
            <div className="kk-right-card">
              {/* Brand Center */}
              <div className="kk-auth-brand-center">
                <div className="kk-auth-icon-box">
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>spa</span>
                </div>
                <span className="kk-auth-portal-title">Klinik Kecantikan</span>
                <span className="kk-auth-portal-sub">Aesthetic &amp; Wellness Portal</span>
              </div>

              {/* Heading */}
              <h2 className="kk-auth-welcome">Selamat Datang</h2>
              <p className="kk-auth-welcome-sub">Silakan masuk ke akun Anda</p>

              {/* Form */}
              <form onSubmit={formik.handleSubmit}>
                {/* Email / Username */}
                <div className="kk-form-group">
                  <label className="kk-label" htmlFor="username-input">
                    Email / Username
                  </label>
                  <div className="kk-input-wrap">
                    <span className="material-symbols-outlined kk-input-icon">person</span>
                    <input
                      id="username-input"
                      name="username"
                      type="text"
                      required
                      value={formik.values.username}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      placeholder="Masukkan username Anda"
                      className="kk-input"
                    />
                  </div>
                  {formik.touched.username && formik.errors.username && (
                    <div className="kk-error-msg">{formik.errors.username}</div>
                  )}
                </div>

                {/* Password */}
                <div className="kk-form-group">
                  <label className="kk-label" htmlFor="password-input">
                    Password
                  </label>
                  <div className="kk-input-wrap">
                    <span className="material-symbols-outlined kk-input-icon">lock</span>
                    <input
                      id="password-input"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formik.values.password}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      placeholder="Masukkan password Anda"
                      className="kk-input has-eye"
                    />
                    <button
                      type="button"
                      aria-label="Tampilkan atau sembunyikan kata sandi"
                      onClick={() => setShowPassword(!showPassword)}
                      className="kk-eye-btn"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {formik.touched.password && formik.errors.password && (
                    <div className="kk-error-msg">{formik.errors.password}</div>
                  )}
                </div>

                {/* Options: Remember me & Forgot Password */}
                <div className="kk-form-options">
                  <label className="kk-remember-label">
                    <input
                      type="checkbox"
                      name="remember_me"
                      checked={Boolean(formik.values.remember_me)}
                      onChange={formik.handleChange}
                      className="kk-remember-checkbox"
                    />
                    <span>Ingat Saya</span>
                  </label>

                  <a href="#" onClick={handleForgotPassword} className="kk-forgot-link">
                    Lupa password?
                  </a>
                </div>

                {/* Submit Button */}
                <button type="submit" disabled={state.load} className="kk-submit-btn">
                  {state.load ? (
                    <>
                      <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '16px' }}>
                        progress_activity
                      </span>
                      <span>Memproses Masuk...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}