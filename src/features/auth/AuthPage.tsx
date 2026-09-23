import { toast } from '@heroui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { loginWithCredentials, registerClient } from '@/api';
import { getUiSession } from '@/app/session';
import { ROLE_PROFILES } from '@/app/roles';
import { Button } from '@/shared/ui';
import { LOCAL_WORKFLOW } from '@/app/runtimeMode';
import { DEMO_ACCOUNTS } from '@/api/localWorkflow';

const SLIDE_COUNT = 3;
const REMEMBER_ME_KEY = 'REMEMBER_ME_CRED';
type ClientType = 'PHYSICAL_PERSON' | 'LEGAL_ENTITY';
const REGISTER_STEPS = [
  { label: 'Profil', icon: 'fa-id-card', title: 'Type de compte client' },
  { label: 'Identité', icon: 'fa-address-card', title: 'Identité & organisation' },
  { label: 'Sécurité', icon: 'fa-shield-halved', title: 'Accès sécurisé' },
] as const;
const LAST_REGISTER_STEP = REGISTER_STEPS.length - 1;

export function AuthPage() {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerStep, setRegisterStep] = useState(0);
  const [clientType, setClientType] = useState<ClientType>('PHYSICAL_PERSON');
  const [identifier, setIdentifier] = useState(() => {
    return window.localStorage.getItem(REMEMBER_ME_KEY) ?? '';
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [legalForm, setLegalForm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isHeroHovered) {
      return;
    }

    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % SLIDE_COUNT);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [isHeroHovered]);

  const goToSlide = (index: number) => {
    setSlideIndex(((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT);
  };

  const selectClientType = (type: ClientType) => {
    setClientType(type);
    setFormError('');
    if (type === 'PHYSICAL_PERSON') {
      setCompanyName('');
      setTradeName('');
      setRegistrationNumber('');
      setLegalForm('');
    }
  };

  const validateRegisterStep = (step: number) => {
    const phone = identifier.trim();
    if (step === 0) {
      return clientType === 'PHYSICAL_PERSON' || clientType === 'LEGAL_ENTITY'
        ? ''
        : 'Choisissez le type de compte client.';
    }
    if (step === 1) {
      if (clientType === 'LEGAL_ENTITY' && (!companyName.trim() || !registrationNumber.trim())) {
        return 'Saisissez la raison sociale et le RCCM / NIF.';
      }
      if (!firstName.trim() || !lastName.trim()) {
        return clientType === 'LEGAL_ENTITY'
          ? 'Saisissez le prénom et le nom du représentant.'
          : 'Saisissez le prénom et le nom.';
      }
      return phone ? '' : 'Saisissez le numéro de téléphone.';
    }
    if (!password.trim()) {
      return 'Saisissez votre mot de passe.';
    }
    if (password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (password !== passwordConfirm) {
      return 'La confirmation du mot de passe ne correspond pas.';
    }
    return '';
  };

  const goToNextRegisterStep = () => {
    const message = validateRegisterStep(registerStep);
    if (message) {
      setFormError(message);
      return;
    }
    setFormError('');
    setRegisterStep((current) => Math.min(current + 1, LAST_REGISTER_STEP));
  };

  const goToPreviousRegisterStep = () => {
    setFormError('');
    setRegisterStep((current) => Math.max(current - 1, 0));
  };

  const switchAuthMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setFormError('');
    setRegisterStep(0);
  };

  const enterWorkspace = async (rawInput: string, secret: string) => {
    const session = await loginWithCredentials(rawInput, secret, { persist: rememberMe });
    navigate(ROLE_PROFILES[session.role].homePath);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'register' && registerStep < LAST_REGISTER_STEP) {
      goToNextRegisterStep();
      return;
    }

    const formData = new FormData(event.currentTarget);
    const rawInput = String(formData.get('identifier') || identifier).trim();
    const secret = String(formData.get('password') || password);
    const selectedClientType = String(formData.get('client_type') || clientType) as ClientType;
    const givenName = String(formData.get('first_name') || firstName).trim();
    const familyName = String(formData.get('last_name') || lastName).trim();
    const legalName = String(formData.get('company_name') || companyName).trim();
    const legalTradeName = String(formData.get('trade_name') || tradeName).trim();
    const legalRegistration = String(formData.get('registration_number') || registrationNumber).trim();
    const legalStatus = String(formData.get('legal_form') || legalForm).trim();
    const confirm = String(formData.get('password_confirm') || passwordConfirm);

    if (rememberMe && rawInput && mode === 'login') {
      window.localStorage.setItem(REMEMBER_ME_KEY, rawInput);
    } else if (!rememberMe) {
      window.localStorage.removeItem(REMEMBER_ME_KEY);
    }

    setFormError('');
    setIsSubmitting(true);

    toast.promise(
      (async () => {
        if (!rawInput || !secret.trim()) {
          throw new Error('Saisissez vos identifiants.');
        }
        if (mode === 'register') {
          if (selectedClientType !== 'PHYSICAL_PERSON' && selectedClientType !== 'LEGAL_ENTITY') {
            throw new Error('Choisissez le type de compte client.');
          }
          if (!givenName || !familyName) {
            throw new Error(
              selectedClientType === 'LEGAL_ENTITY'
                ? 'Saisissez le prénom et le nom du représentant.'
                : 'Saisissez le prénom et le nom.',
            );
          }
          if (selectedClientType === 'LEGAL_ENTITY' && (!legalName || !legalRegistration)) {
            throw new Error('Saisissez la raison sociale et le RCCM / NIF.');
          }
          if (secret.length < 8) {
            throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
          }
          if (secret !== confirm) {
            throw new Error('La confirmation du mot de passe ne correspond pas.');
          }
          await registerClient({
            client_type: selectedClientType,
            first_name: givenName,
            last_name: familyName,
            phone: rawInput,
            password: secret,
            company_name: selectedClientType === 'LEGAL_ENTITY' ? legalName : undefined,
            trade_name: selectedClientType === 'LEGAL_ENTITY' ? legalTradeName || undefined : undefined,
            registration_number: selectedClientType === 'LEGAL_ENTITY' ? legalRegistration : undefined,
            legal_form: selectedClientType === 'LEGAL_ENTITY' ? legalStatus || undefined : undefined,
          });
        }
        await enterWorkspace(rawInput, secret);
      })()
        .catch((err) => {
          setFormError(err instanceof Error ? err.message : 'Connexion impossible');
          throw err;
        })
        .finally(() => setIsSubmitting(false)),
      {
        loading: mode === 'register' ? 'Création du compte…' : 'Authentification sécurisée...',
        success: mode === 'register' ? 'Compte créé, espace chargé' : 'Espace chargé',
        error: (err) => (err instanceof Error ? err.message : 'Connexion impossible'),
      },
    );
  };

  if (getUiSession()) {
    const session = getUiSession();
    return <Navigate to={session ? ROLE_PROFILES[session.role].homePath : '/app/client'} replace />;
  }

  return (
    <div id="auth-view">
      <div className="auth-container">
        <div
          className="auth-hero-pane"
          id="auth-hero-pane"
          onMouseEnter={() => setIsHeroHovered(true)}
          onMouseLeave={() => setIsHeroHovered(false)}
        >
          <div className="auth-hero-slider full-bleed" id="auth-hero-slider">
            <div className="auth-slider-track">
              <div
                className={`auth-slide${slideIndex === 0 ? " active" : ""}`}
                data-slide="0"
              >
                <img
                  src="/images/slide4.png"
                  alt="Financement TPE & Particuliers"
                  className="auth-slide-img"
                />
                <div
                  className="auth-slide-bg"
                  style={{ backgroundImage: "url('/images/slide4.png')" }}
                ></div>
                <div className="auth-slide-overlay"></div>
              </div>

              <div
                className={`auth-slide${slideIndex === 1 ? " active" : ""}`}
                data-slide="1"
              >
                <img
                  src="/images/slide5.png"
                  alt="Déblocage rapide < 48h"
                  className="auth-slide-img"
                />
                <div
                  className="auth-slide-bg"
                  style={{ backgroundImage: "url('/images/slide5.png')" }}
                ></div>
                <div className="auth-slide-overlay"></div>
              </div>

              <div
                className={`auth-slide${slideIndex === 2 ? " active" : ""}`}
                data-slide="2"
              >
                <img
                  src="/images/slide3.jpg"
                  alt="Paiement Mobile Money flexible"
                  className="auth-slide-img"
                />
                <div
                  className="auth-slide-bg"
                  style={{ backgroundImage: "url('/images/slide3.jpg')" }}
                ></div>
                <div className="auth-slide-overlay"></div>
              </div>
            </div>
          </div>

          <div className="auth-hero-foreground">
            <div className="auth-hero-top">
              <div className="auth-brand">
                <div className="auth-brand-logo-white">
                  <img src="/images/logo/lg-horizont-white.png" alt="" />
                </div>
              </div>
            </div>

            <div className="auth-hero-center">
              <div
                className={`auth-slide-text-block${slideIndex === 0 ? " active" : ""}`}
                data-slide-text="0"
              >
                <span className="auth-slide-tag-pill tag-emerald">
                  <i className="fas fa-shop"></i> 1. Financement sur-mesure
                </span>
                <h1 className="auth-hero-title">
                  Financez vos projets et développez votre activité
                </h1>
                <p className="auth-hero-desc">
                  Une solution 100% digitale pour concrétiser vos ambitions :
                  simulation de crédit en direct, constitution de dossier
                  simplifiée et obtention d'une offre claire adaptée à votre
                  trésorerie.
                </p>
              </div>

              <div
                className={`auth-slide-text-block${slideIndex === 1 ? " active" : ""}`}
                data-slide-text="1"
              >
                <span className="auth-slide-tag-pill tag-sky">
                  <i className="fas fa-bolt"></i> 2. Décision & Déblocage Rapide
                </span>
                <h1 className="auth-hero-title">
                  Votre argent disponible sans attente inutile
                </h1>
                <p className="auth-hero-desc">
                  Suivez l'avancement de votre dossier 24h/24 depuis votre
                  téléphone. Après validation par nos analystes et le comité,
                  vos fonds sont mis à votre disposition en moins de 48 heures.
                </p>
              </div>

              <div
                className={`auth-slide-text-block${slideIndex === 2 ? " active" : ""}`}
                data-slide-text="2"
              >
                <span className="auth-slide-tag-pill tag-purple">
                  <i className="fas fa-wallet"></i> 3. Paiement Mobile Flexible
                </span>
                <h1 className="auth-hero-title">
                  Remboursez vos mensualités en toute tranquillité
                </h1>
                <p className="auth-hero-desc">
                  Payez vos échéances directement par Mobile Money (Wave, Orange
                  Money, Moov Money, Free Money), consultez votre solde en temps
                  réel et téléchargez vos quittances officielles.
                </p>
              </div>
            </div>

            <div className="auth-hero-bottom">
              <div className="auth-hero-nav-bar">
                <div className="auth-slider-dots-bar" id="auth-slider-dots">
                  <button
                    type="button"
                    className={`auth-slider-dot${slideIndex === 0 ? " active" : ""}`}
                    onClick={() => goToSlide(0)}
                    aria-label="Slide 1 : Financement d'activité"
                    title="Financement d'activité"
                  ></button>
                  <button
                    type="button"
                    className={`auth-slider-dot${slideIndex === 1 ? " active" : ""}`}
                    onClick={() => goToSlide(1)}
                    aria-label="Slide 2 : Déblocage rapide"
                    title="Déblocage en < 48h"
                  ></button>
                  <button
                    type="button"
                    className={`auth-slider-dot${slideIndex === 2 ? " active" : ""}`}
                    onClick={() => goToSlide(2)}
                    aria-label="Slide 3 : Remboursement Mobile Money"
                    title="Remboursement Mobile Money"
                  ></button>
                </div>

                <div className="auth-slider-controls">
                  <button
                    type="button"
                    className="auth-slider-btn"
                    onClick={() => goToSlide(slideIndex - 1)}
                    aria-label="Photo précédente"
                    title="Précédent"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button
                    type="button"
                    className="auth-slider-btn"
                    onClick={() => goToSlide(slideIndex + 1)}
                    aria-label="Photo suivante"
                    title="Suivant"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>

              <div className="auth-countries-strip">
                <i className="fas fa-location-dot text-emerald"></i>
                <span>
                  Plateforme Nationale CreditFast Mali :{" "}
                  <span className="fi fi-ml"></span> Bamako & Régions •
                  Conformité
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-form-pane">
          <div className="auth-form-box" data-auth-mode={mode}>
            <div className="auth-mobile-brand">
              <div className="auth-brand-logo-original" aria-hidden="true">
                <img src="/images/logo/logo-horizontal.png" alt="" />
              </div>
            </div>

            <div className="auth-header">
              <h2>
                {mode === "register"
                  ? "Créer un compte client"
                  : "Portail d'Accès Sécurisé"}
              </h2>
              <p>
                {mode === "register"
                  ? "Inscription publique : téléphone unique + mot de passe (8 caractères min.). Puis connexion automatique."
                  : "Client : téléphone + mot de passe. Équipe : e-mail professionnel. Le compte client n’accepte pas l’e-mail."}
              </p>
            </div>

            <form id="login-form" noValidate onSubmit={handleSubmit}>
              {LOCAL_WORKFLOW && <fieldset className="form-group">
                <legend>Atelier des parcours — mode local</legend>
                <p>Aucun backend connecté. Données fictives enregistrées dans ce navigateur. Choisissez un scénario, puis connectez-vous.</p>
                <label className="form-label" htmlFor="demo-scenario">Scénario à tester</label>
                <select id="demo-scenario" className="form-control" value="" onChange={event => {
                  if (!event.target.value) return;
                  switchAuthMode('login');
                  setIdentifier(event.target.value);
                  setPassword('demo-local');
                }}>
                  <option value="">Choisir un parcours…</option>
                  {DEMO_ACCOUNTS.map(account => <option key={account.identifier} value={account.identifier}>{account.label}</option>)}
                </select>
                <small>Authentification simulée : les mots de passe ne sont ni vérifiés ni enregistrés.</small>
              </fieldset>}
              {mode === "register" ? (
                <>
                  <div className="auth-stepper" aria-label="Progression de création de compte">
                    {REGISTER_STEPS.map((step, index) => {
                      const isActive = registerStep === index;
                      const isDone = registerStep > index;
                      return (
                        <button
                          key={step.label}
                          type="button"
                          className={`auth-stepper-item${isActive ? " active" : ""}${isDone ? " done" : ""}`}
                          aria-current={isActive ? "step" : undefined}
                          disabled={index > registerStep}
                          onClick={() => {
                            if (index <= registerStep) {
                              setFormError("");
                              setRegisterStep(index);
                            }
                          }}
                        >
                          <span className="auth-stepper-dot">
                            <i className={`fas ${isDone ? "fa-check" : step.icon}`}></i>
                          </span>
                          <span>{step.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="auth-register-stage" data-register-step={registerStep}>
                    <div className="auth-register-stage-head">
                      <span>Étape {registerStep + 1} / {REGISTER_STEPS.length}</span>
                      <strong>{REGISTER_STEPS[registerStep].title}</strong>
                    </div>

                    {formError ? (
                      <div className="auth-form-alert" role="alert">
                        <i className="fas fa-circle-exclamation"></i>
                        <span>{formError}</span>
                      </div>
                    ) : null}

                    {registerStep === 0 ? (
                      <div
                        className="auth-client-type-grid"
                        role="radiogroup"
                        aria-label="Type de compte client"
                      >
                        <label
                          className={`auth-client-type-card${clientType === "PHYSICAL_PERSON" ? " active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="client_type"
                            value="PHYSICAL_PERSON"
                            checked={clientType === "PHYSICAL_PERSON"}
                            onChange={() => selectClientType("PHYSICAL_PERSON")}
                          />
                          <span className="auth-client-type-icon">
                            <i className="fas fa-user"></i>
                          </span>
                          <span className="auth-client-type-copy">
                            <span className="auth-client-type-kicker">Profil client</span>
                            <strong>Personne physique</strong>
                            <small>Particulier ou entrepreneur individuel</small>
                          </span>
                          <span className="auth-client-type-check" aria-hidden="true">
                            <i className="fas fa-check"></i>
                          </span>
                        </label>

                        <label
                          className={`auth-client-type-card${clientType === "LEGAL_ENTITY" ? " active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="client_type"
                            value="LEGAL_ENTITY"
                            checked={clientType === "LEGAL_ENTITY"}
                            onChange={() => selectClientType("LEGAL_ENTITY")}
                          />
                          <span className="auth-client-type-icon">
                            <i className="fas fa-building"></i>
                          </span>
                          <span className="auth-client-type-copy">
                            <span className="auth-client-type-kicker">Organisation</span>
                            <strong>Personne morale</strong>
                            <small>Entreprise, coopérative ou groupement</small>
                          </span>
                          <span className="auth-client-type-check" aria-hidden="true">
                            <i className="fas fa-check"></i>
                          </span>
                        </label>
                      </div>
                    ) : null}

                    {registerStep === 1 ? (
                      <>
                        {clientType === "LEGAL_ENTITY" ? (
                          <div className="auth-legal-box">
                            <div className="auth-legal-head">
                              <i className="fas fa-file-signature"></i>
                              <span>Informations de l’organisation</span>
                            </div>
                            <div className="auth-form-grid">
                              <div>
                                <label className="form-label" htmlFor="register-company-name">
                                  Raison sociale
                                </label>
                                <input
                                  type="text"
                                  id="register-company-name"
                                  name="company_name"
                                  className="form-control"
                                  value={companyName}
                                  placeholder="SARL Agro Négoce Mali"
                                  required
                                  onChange={(event) => {
                                    setCompanyName(event.target.value);
                                    setFormError("");
                                  }}
                                />
                              </div>
                              <div>
                                <label className="form-label" htmlFor="register-number">
                                  RCCM / NIF
                                </label>
                                <input
                                  type="text"
                                  id="register-number"
                                  name="registration_number"
                                  className="form-control"
                                  value={registrationNumber}
                                  placeholder="MA.BKO.2024.B.12345"
                                  required
                                  onChange={(event) => {
                                    setRegistrationNumber(event.target.value);
                                    setFormError("");
                                  }}
                                />
                              </div>
                              <div>
                                <label className="form-label" htmlFor="register-trade-name">
                                  Nom commercial
                                </label>
                                <input
                                  type="text"
                                  id="register-trade-name"
                                  name="trade_name"
                                  className="form-control"
                                  value={tradeName}
                                  placeholder="AgroNégoce"
                                  onChange={(event) => setTradeName(event.target.value)}
                                />
                              </div>
                              <div>
                                <label className="form-label" htmlFor="register-legal-form">
                                  Forme juridique
                                </label>
                                <input
                                  type="text"
                                  id="register-legal-form"
                                  name="legal_form"
                                  className="form-control"
                                  value={legalForm}
                                  placeholder="SARL, GIE, Coopérative"
                                  onChange={(event) => setLegalForm(event.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="auth-form-grid form-group">
                          <div>
                            <label className="form-label" htmlFor="register-first-name">
                              {clientType === "LEGAL_ENTITY" ? "Prénom du représentant" : "Prénom"}
                            </label>
                            <input
                              type="text"
                              id="register-first-name"
                              name="first_name"
                              className="form-control"
                              value={firstName}
                              autoComplete="given-name"
                              required
                              onChange={(event) => {
                                setFirstName(event.target.value);
                                setFormError("");
                              }}
                            />
                          </div>
                          <div>
                            <label className="form-label" htmlFor="register-last-name">
                              {clientType === "LEGAL_ENTITY" ? "Nom du représentant" : "Nom"}
                            </label>
                            <input
                              type="text"
                              id="register-last-name"
                              name="last_name"
                              className="form-control"
                              value={lastName}
                              autoComplete="family-name"
                              required
                              onChange={(event) => {
                                setLastName(event.target.value);
                                setFormError("");
                              }}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="register-phone">
                            Téléphone
                          </label>
                          <div className="input-with-icon">
                            <i className="fas fa-phone input-prefix-icon"></i>
                            <input
                              type="text"
                              id="register-phone"
                              name="identifier"
                              className="form-control"
                              placeholder="+223 70 12 34 56"
                              value={identifier}
                              autoComplete="username"
                              required
                              onChange={(event) => {
                                setIdentifier(event.target.value);
                                setFormError("");
                              }}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {registerStep === 2 ? (
                      <>
                        <div className="auth-register-summary">
                          <span>
                            <i className="fas fa-user-check"></i>
                            {clientType === "LEGAL_ENTITY" ? "Personne morale" : "Personne physique"}
                          </span>
                          <span>{clientType === "LEGAL_ENTITY" ? companyName || "Organisation" : `${firstName} ${lastName}`.trim() || "Client"}</span>
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="login-password">
                            Mot de Passe
                          </label>
                          <div className="input-with-icon input-with-suffix">
                            <i className="fas fa-lock input-prefix-icon"></i>
                            <input
                              type={showPassword ? "text" : "password"}
                              id="login-password"
                              name="password"
                              className="form-control"
                              value={password}
                              placeholder="8 caractères minimum"
                              autoComplete="new-password"
                              required
                              onChange={(event) => {
                                setPassword(event.target.value);
                                setFormError("");
                              }}
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              id="btn-toggle-password"
                              title="Afficher ou masquer le mot de passe"
                              aria-label="Afficher ou masquer le mot de passe"
                              onClick={() => setShowPassword((current) => !current)}
                            >
                              <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="register-password-confirm">
                            Confirmer le mot de passe
                          </label>
                          <input
                            type={showPassword ? "text" : "password"}
                            id="register-password-confirm"
                            name="password_confirm"
                            className="form-control"
                            value={passwordConfirm}
                            autoComplete="new-password"
                            required
                            onChange={(event) => {
                              setPasswordConfirm(event.target.value);
                              setFormError("");
                            }}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="auth-step-actions">
                    <button
                      type="button"
                      className="auth-step-back-btn"
                      disabled={registerStep === 0}
                      onClick={goToPreviousRegisterStep}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Retour
                    </button>

                    {registerStep < LAST_REGISTER_STEP ? (
                      <button type="button" className="auth-step-next-btn" onClick={goToNextRegisterStep}>
                        Suivant
                        <i className="fas fa-arrow-right"></i>
                      </button>
                    ) : (
                      <Button
                        type="submit"
                        id="btn-submit-register"
                        variant="primary"
                        className="auth-submit-btn"
                        disabled={isSubmitting}
                      >
                        <span id="login-btn-content">
                          {isSubmitting ? (
                            <>
                              <i className="fas fa-circle-notch fa-spin mr-2"></i> Création du compte…
                            </>
                          ) : (
                            <>
                              <i className="fas fa-user-plus mr-1"></i> Créer mon accès CreditFast
                            </>
                          )}
                        </span>
                      </Button>
                    )}
                  </div>

                  <div className="auth-options-row auth-options-row-register">
                    <p>Votre accès CreditFast est distinct du compte épargne bancaire. Après connexion, votre compte épargne est vérifié automatiquement. Une pièce d’identité est obligatoire pour compléter votre profil et demander un prêt.</p>
                    <span />
                    <button
                      type="button"
                      className="auth-link-subtle"
                      onClick={() => switchAuthMode("login")}
                    >
                      Déjà un compte ? Se connecter
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <div className="cf-auth-field-head">
                      <label className="form-label" htmlFor="login-email">
                        Téléphone ou e-mail professionnel
                      </label>
                      {formError ? (
                        <i
                          className="fas fa-circle-exclamation cf-auth-field-error-icon"
                          title={formError}
                          aria-label={formError}
                          role="img"
                        ></i>
                      ) : null}
                    </div>
                    <div className="input-with-icon">
                      <i className="fas fa-user-check input-prefix-icon"></i>
                      <input
                        type="text"
                        id="login-email"
                        name="identifier"
                        className="form-control"
                        placeholder="+223 70 12 34 56"
                        value={identifier}
                        autoComplete="username"
                        required
                        aria-invalid={formError ? true : undefined}
                        onChange={(event) => {
                          setIdentifier(event.target.value);
                          if (formError) {
                            setFormError("");
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="login-password">
                      Mot de Passe
                    </label>
                    <div className="input-with-icon input-with-suffix">
                      <i className="fas fa-lock input-prefix-icon"></i>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="login-password"
                        name="password"
                        className="form-control"
                        value={password}
                        placeholder="Saisissez votre mot de passe"
                        autoComplete="current-password"
                        required
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        id="btn-toggle-password"
                        title="Afficher ou masquer le mot de passe"
                        aria-label="Afficher ou masquer le mot de passe"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                      </button>
                    </div>
                  </div>

                  <div className="auth-options-row">
                    <label
                      className="auth-checkbox-label"
                      htmlFor="remember-me-checkbox"
                    >
                      <input
                        type="checkbox"
                        id="remember-me-checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                      />
                      <span>Mémoriser ma session</span>
                    </label>
                    <button
                      type="button"
                      className="auth-link-subtle"
                      onClick={() => switchAuthMode("register")}
                    >
                      Créer un compte client
                    </button>
                  </div>

                  <Button
                    type="submit"
                    id="btn-submit-login"
                    variant="primary"
                    className="auth-submit-btn"
                    disabled={isSubmitting}
                  >
                    <span id="login-btn-content">
                      {isSubmitting ? (
                        <>
                          <i className="fas fa-circle-notch fa-spin mr-2"></i> Authentification sécurisée...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-right-to-bracket mr-1"></i> Se Connecter à mon Espace
                        </>
                      )}
                    </span>
                  </Button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
