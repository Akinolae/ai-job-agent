'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import type { CandidateProfile } from '../../config/firebase';
import { TagInput } from '../ui/tag-input';
import { 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiMapPin, 
  FiBriefcase, 
  FiFileText, 
  FiTarget, 
  FiGlobe, 
  FiZap, 
  FiTool, 
  FiLayers, 
  FiFolder, 
  FiStar, 
  FiTrendingUp, 
  FiAward, 
  FiShield, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiTrash2,
  FiUploadCloud
} from 'react-icons/fi';
import { TbSparkles } from 'react-icons/tb';

export const profileValidationSchema = Yup.object({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .required('Full name is required'),
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email address is required'),
  phone: Yup.string()
    .min(5, 'Phone number is required')
    .required('Phone number is required'),
  location: Yup.string()
    .min(2, 'Current location is required')
    .required('Current location is required'),
  workAuthorization: Yup.string()
    .required('Work authorization is required'),
  professionalSummary: Yup.string()
    .max(3000, 'Summary cannot exceed 3000 characters'),
  experienceYears: Yup.number()
    .typeError('Experience must be a valid number')
    .min(0, 'Experience cannot be negative')
    .max(60, 'Experience cannot exceed 60 years')
    .required('Years of experience is required'),
  targetRoles: Yup.array()
    .of(Yup.string())
    .min(1, 'Please specify at least 1 target role'),
  potentiallyQualifiedRoles: Yup.array()
    .of(Yup.string()),
  targetLocations: Yup.array()
    .of(Yup.string())
    .min(1, 'Please specify at least 1 target location'),
  coreSkills: Yup.array()
    .of(Yup.string())
    .min(1, 'Please specify at least 1 core domain skill'),
  toolsAndPlatforms: Yup.array()
    .of(Yup.string())
    .min(1, 'Please specify at least 1 tool / software skill')
});

interface CustomCategoryItem {
  id: number;
  name: string;
  skills: string;
}

interface CandidateProfileFormProps {
  profile: CandidateProfile | null;
  onSave: (updatedProfile: CandidateProfile) => Promise<void>;
  isUpdating: boolean;
  onOpenParseModal: () => void;
}

export const CandidateProfileForm: React.FC<CandidateProfileFormProps> = ({
  profile,
  onSave,
  isUpdating,
  onOpenParseModal
}) => {
  const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>(() => {
    if (profile?.customCategories && profile.customCategories.length > 0) {
      return profile.customCategories.map((c, idx) => ({
        id: idx + 1,
        name: c.name,
        skills: c.skills.join(', ')
      }));
    }
    return [];
  });

  const formik = useFormik({
    initialValues: {
      name: profile?.name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      location: profile?.location || '',
      professionalSummary: profile?.professionalSummary || '',
      experienceYears: profile?.experienceYears || 5,
      workAuthorization: profile?.workAuthorization || 'Eligible / Open to Relocation',
      targetRoles: profile?.targetRoles || ['Senior Full-Stack Engineer'],
      potentiallyQualifiedRoles: profile?.potentiallyQualifiedRoles || [],
      targetLocations: profile?.targetLocations || ['Remote Worldwide', 'United Kingdom', 'Germany', 'United States'],
      coreSkills: profile?.coreSkills || profile?.skills?.core || ['Full-Stack Development', 'System Architecture'],
      toolsAndPlatforms: profile?.toolsAndPlatforms || profile?.skills?.tools || ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      salaryMin: profile?.salaryExpectationEUR?.min || 75000,
      salaryTarget: profile?.salaryExpectationEUR?.target || 90000,
      salaryCurrency: profile?.salaryExpectationEUR?.currency || 'EUR'
    },
    validationSchema: profileValidationSchema,
    enableReinitialize: true,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      const parsedCustomCategories = customCategories
        .map(c => ({
          name: c.name.trim(),
          skills: c.skills.split(',').map(s => s.trim()).filter(Boolean)
        }))
        .filter(c => c.name.length > 0);

      const skillsMap: Record<string, string[]> = {
        core: values.coreSkills,
        tools: values.toolsAndPlatforms
      };
      parsedCustomCategories.forEach(c => {
        skillsMap[c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')] = c.skills;
      });

      const updatedProfile: CandidateProfile = {
        ...profile,
        name: values.name,
        email: values.email,
        phone: values.phone,
        location: values.location,
        professionalSummary: values.professionalSummary,
        experienceYears: Number(values.experienceYears),
        workAuthorization: values.workAuthorization,
        targetRoles: values.targetRoles,
        potentiallyQualifiedRoles: values.potentiallyQualifiedRoles,
        targetLocations: values.targetLocations,
        coreSkills: values.coreSkills,
        toolsAndPlatforms: values.toolsAndPlatforms,
        customCategories: parsedCustomCategories,
        skills: skillsMap,
        salaryExpectationEUR: {
          min: Number(values.salaryMin) || 0,
          target: Number(values.salaryTarget) || 0,
          currency: values.salaryCurrency || 'EUR'
        },
        cvStoragePath: profile?.cvStoragePath || '',
        updatedAt: new Date().toISOString()
      };

      await onSave(updatedProfile);
    }
  });

  const addCustomCategory = () => {
    setCustomCategories(prev => [
      ...prev,
      { id: Date.now(), name: '', skills: '' }
    ]);
  };

  const removeCustomCategory = (id: number) => {
    setCustomCategories(prev => prev.filter(c => c.id !== id));
  };

  const updateCustomCategory = (id: number, field: 'name' | 'skills', value: string) => {
    setCustomCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <div className="profile-editor-layout">
      {/* Left Column: Candidate Hero & Resume Importer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="candidate-hero-card">
          <div className="candidate-hero-header">
            <div className="candidate-avatar-large">
              <span>{(formik.values.name || 'C').charAt(0).toUpperCase()}</span>
            </div>
            <h3 className="candidate-hero-name">{formik.values.name || 'Candidate Name'}</h3>
            <div className="candidate-hero-role">
              {formik.values.targetRoles[0] || 'Professional Specialist'}
            </div>
            <div className="candidate-hero-badge">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
              <span>Ready for AI Matching</span>
            </div>
          </div>

          <div className="candidate-stats-grid">
            <div className="candidate-stat-item">
              <div className="candidate-stat-num">{formik.values.experienceYears}y</div>
              <div className="candidate-stat-label">Exp</div>
            </div>
            <div className="candidate-stat-item">
              <div className="candidate-stat-num">{formik.values.targetRoles.length}</div>
              <div className="candidate-stat-label">Roles</div>
            </div>
            <div className="candidate-stat-item">
              <div className="candidate-stat-num">{formik.values.coreSkills.length}</div>
              <div className="candidate-stat-label">Skills</div>
            </div>
          </div>

          <div 
            className="resume-dropzone-card"
            onClick={onOpenParseModal}
            style={{ cursor: 'pointer', marginTop: '1rem' }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>📄</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Upload & Parse Resume
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              AI extracts skills & career tracks
            </div>
          </div>
        </div>

        <div className="form-section-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Active Storage File</h4>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Last Synced:</span>
              <span style={{ fontWeight: 500 }}>
                {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'Never'}
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', wordBreak: 'break-all', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginTop: '0.5rem' }}>
              {profile?.cvStoragePath || 'No CV file uploaded yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Formik Profile Form */}
      <div>
        <form onSubmit={formik.handleSubmit} noValidate>
          {/* 1. Identity & Contact Section */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-group">
                <div className="form-section-icon"><FiUser /></div>
                <div>
                  <h3 className="form-section-title">Personal & Contact Details</h3>
                  <p className="form-section-subtitle">Candidate identity and communication channels for automated cover letters.</p>
                </div>
              </div>
            </div>

            <div className="profile-form-grid" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label-modern" htmlFor="prof-name">
                  <span>Full Name</span>
                </label>
                <div className="input-icon-wrapper">
                  <span className="input-leading-icon"><FiUser /></span>
                  <input 
                    type="text" 
                    id="prof-name" 
                    name="name"
                    className={`form-control-modern form-control-with-icon ${formik.touched.name && formik.errors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Alex Morgan"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>
                {formik.touched.name && formik.errors.name && (
                  <div className="form-error-msg"><FiAlertCircle /> {formik.errors.name}</div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label-modern" htmlFor="prof-email">
                  <span>Email Address</span>
                </label>
                <div className="input-icon-wrapper">
                  <span className="input-leading-icon"><FiMail /></span>
                  <input 
                    type="email" 
                    id="prof-email" 
                    name="email"
                    className={`form-control-modern form-control-with-icon ${formik.touched.email && formik.errors.email ? 'input-error' : ''}`}
                    placeholder="you@domain.com"
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>
                {formik.touched.email && formik.errors.email && (
                  <div className="form-error-msg"><FiAlertCircle /> {formik.errors.email}</div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label-modern" htmlFor="prof-phone">
                  <span>Phone Number</span>
                </label>
                <div className="input-icon-wrapper">
                  <span className="input-leading-icon"><FiPhone /></span>
                  <input 
                    type="text" 
                    id="prof-phone" 
                    name="phone"
                    className={`form-control-modern form-control-with-icon ${formik.touched.phone && formik.errors.phone ? 'input-error' : ''}`}
                    placeholder="+1 555 000 0000"
                    value={formik.values.phone}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>
                {formik.touched.phone && formik.errors.phone && (
                  <div className="form-error-msg"><FiAlertCircle /> {formik.errors.phone}</div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label-modern" htmlFor="prof-loc">
                  <span>Current Location</span>
                </label>
                <div className="input-icon-wrapper">
                  <span className="input-leading-icon"><FiMapPin /></span>
                  <input 
                    type="text" 
                    id="prof-loc" 
                    name="location"
                    className={`form-control-modern form-control-with-icon ${formik.touched.location && formik.errors.location ? 'input-error' : ''}`}
                    placeholder="e.g. London, UK"
                    value={formik.values.location}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>
                {formik.touched.location && formik.errors.location && (
                  <div className="form-error-msg"><FiAlertCircle /> {formik.errors.location}</div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Professional Summary Section */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-group">
                <div className="form-section-icon"><FiFileText /></div>
                <div>
                  <h3 className="form-section-title">Professional Summary & Bio</h3>
                  <p className="form-section-subtitle">Executive overview used by AI to synthesize tailored application summaries.</p>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <textarea 
                id="prof-summary" 
                name="professionalSummary"
                className={`form-control-modern ${formik.touched.professionalSummary && formik.errors.professionalSummary ? 'input-error' : ''}`}
                rows={3}
                placeholder="Brief 2-3 sentence executive overview of your background, core strengths, and domain expertise..."
                value={formik.values.professionalSummary}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.professionalSummary && formik.errors.professionalSummary && (
                <div className="form-error-msg"><FiAlertCircle /> {formik.errors.professionalSummary}</div>
              )}
            </div>
          </div>

          {/* 3. Target & AI-Qualified Roles Section */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-group">
                <div className="form-section-icon"><FiTarget /></div>
                <div>
                  <h3 className="form-section-title">Target Roles & Specializations</h3>
                  <p className="form-section-subtitle">Primary career tracks and related roles used for rubric title matching.</p>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label-modern" htmlFor="prof-roles">
                <span>Primary Target Roles (Exact Matches)</span>
                <span className="form-label-badge">High Priority</span>
              </label>
              <TagInput 
                id="prof-roles"
                tags={formik.values.targetRoles}
                onChange={(tags) => formik.setFieldValue('targetRoles', tags)}
                placeholder="Add target role (e.g. Senior Frontend Engineer, Social Media Lead)..."
                theme="emerald"
                icon={<FiTarget style={{ fontSize: '0.75rem' }} />}
              />
              {formik.touched.targetRoles && formik.errors.targetRoles && (
                <div className="form-error-msg"><FiAlertCircle /> {typeof formik.errors.targetRoles === 'string' ? formik.errors.targetRoles : 'At least 1 role required'}</div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label-modern" htmlFor="prof-qualified-roles">
                <span>Potentially Qualified / Adjacent Roles</span>
                <span className="form-label-badge" style={{ color: 'var(--info-color)' }}>Secondary Tracks</span>
              </label>
              <TagInput 
                id="prof-qualified-roles"
                tags={formik.values.potentiallyQualifiedRoles}
                onChange={(tags) => formik.setFieldValue('potentiallyQualifiedRoles', tags)}
                placeholder="Add adjacent roles (e.g. Growth Specialist, Full-Stack Engineer, Product Marketer)..."
                theme="blue"
                icon={<FiBriefcase style={{ fontSize: '0.75rem' }} />}
              />
            </div>
          </div>

          {/* 4. Geography & Work Authorization */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-group">
                <div className="form-section-icon"><FiGlobe /></div>
                <div>
                  <h3 className="form-section-title">Geography, Modality & Authorization</h3>
                  <p className="form-section-subtitle">Target regions, remote preferences, and visa status.</p>
                </div>
              </div>
            </div>

            <div className="profile-form-grid" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label-modern" htmlFor="prof-exp">
                  <span>Years of Professional Experience</span>
                </label>
                <div className="input-icon-wrapper">
                  <span className="input-leading-icon"><FiTrendingUp /></span>
                  <input 
                    type="number" 
                    id="prof-exp" 
                    name="experienceYears"
                    min="0" 
                    max="50" 
                    className={`form-control-modern form-control-with-icon ${formik.touched.experienceYears && formik.errors.experienceYears ? 'input-error' : ''}`}
                    value={formik.values.experienceYears}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>
                {formik.touched.experienceYears && formik.errors.experienceYears && (
                  <div className="form-error-msg"><FiAlertCircle /> {formik.errors.experienceYears}</div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label-modern" htmlFor="prof-auth">
                  <span>Work Authorization & Relocation</span>
                </label>
                <div className="input-icon-wrapper">
                  <span className="input-leading-icon"><FiShield /></span>
                  <input 
                    type="text" 
                    id="prof-auth" 
                    name="workAuthorization"
                    className={`form-control-modern form-control-with-icon ${formik.touched.workAuthorization && formik.errors.workAuthorization ? 'input-error' : ''}`}
                    placeholder="e.g. EU Citizen / Open to Relocation"
                    value={formik.values.workAuthorization}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </div>
                {formik.touched.workAuthorization && formik.errors.workAuthorization && (
                  <div className="form-error-msg"><FiAlertCircle /> {formik.errors.workAuthorization}</div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label-modern" htmlFor="prof-target-locs">
                <span>Target Job Locations & Remote Regions</span>
                <span className="form-label-badge">Location Priority</span>
              </label>
              <TagInput 
                id="prof-target-locs"
                tags={formik.values.targetLocations}
                onChange={(tags) => formik.setFieldValue('targetLocations', tags)}
                placeholder="Add regions (e.g. Remote Worldwide, United Kingdom, Germany, United States)..."
                theme="emerald"
                icon={<FiGlobe style={{ fontSize: '0.75rem' }} />}
              />
              {formik.touched.targetLocations && formik.errors.targetLocations && (
                <div className="form-error-msg"><FiAlertCircle /> {typeof formik.errors.targetLocations === 'string' ? formik.errors.targetLocations : 'At least 1 location required'}</div>
              )}
            </div>
          </div>

          {/* 5. Core Competencies & Software Tools */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-group">
                <div className="form-section-icon"><FiZap /></div>
                <div>
                  <h3 className="form-section-title">Core Skills & Software Tools</h3>
                  <p className="form-section-subtitle">Evaluated during 3-tier matching and injected into cover letters.</p>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label-modern" htmlFor="prof-skills-core">
                <span>Core Domain Competencies & Methodologies</span>
                <span className="form-label-badge">Domain Expertise</span>
              </label>
              <TagInput 
                id="prof-skills-core"
                tags={formik.values.coreSkills}
                onChange={(tags) => formik.setFieldValue('coreSkills', tags)}
                placeholder="Add core skills (e.g. Full-Stack Development, Growth Marketing, System Architecture)..."
                theme="purple"
                icon={<FiZap style={{ fontSize: '0.75rem' }} />}
              />
              {formik.touched.coreSkills && formik.errors.coreSkills && (
                <div className="form-error-msg"><FiAlertCircle /> {typeof formik.errors.coreSkills === 'string' ? formik.errors.coreSkills : 'At least 1 skill required'}</div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label-modern" htmlFor="prof-skills-tools">
                <span>Tools, Software & Platforms</span>
                <span className="form-label-badge" style={{ color: '#f59e0b' }}>Software Stack</span>
              </label>
              <TagInput 
                id="prof-skills-tools"
                tags={formik.values.toolsAndPlatforms}
                onChange={(tags) => formik.setFieldValue('toolsAndPlatforms', tags)}
                placeholder="Add tools (e.g. React, Next.js, TypeScript, Node.js, Go, PostgreSQL, Docker)..."
                theme="amber"
                icon={<FiTool style={{ fontSize: '0.75rem' }} />}
              />
              {formik.touched.toolsAndPlatforms && formik.errors.toolsAndPlatforms && (
                <div className="form-error-msg"><FiAlertCircle /> {typeof formik.errors.toolsAndPlatforms === 'string' ? formik.errors.toolsAndPlatforms : 'At least 1 tool required'}</div>
              )}
            </div>
          </div>

          {/* 6. Dynamic Custom Skill Groups */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-group">
                <div className="form-section-icon"><FiFolder /></div>
                <div>
                  <h3 className="form-section-title">Custom Skill Groups</h3>
                  <p className="form-section-subtitle">Define custom specialized categories for your profession.</p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-outline" 
                onClick={addCustomCategory}
              >
                + Add Group
              </button>
            </div>

            {customCategories.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                No custom skill groups added yet. Click &ldquo;+ Add Group&rdquo; to define discipline-specific categories.
              </div>
            ) : (
              customCategories.map(cat => (
                <div key={cat.id} className="category-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                  <input 
                    type="text" 
                    className="form-control-modern" 
                    placeholder="Group (e.g. Databases)"
                    value={cat.name}
                    onChange={(e) => updateCustomCategory(cat.id, 'name', e.target.value)}
                    style={{ fontWeight: 600 }}
                  />
                  <input 
                    type="text" 
                    className="form-control-modern" 
                    placeholder="Comma-separated items (e.g. PostgreSQL, Redis, MongoDB)"
                    value={cat.skills}
                    onChange={(e) => updateCustomCategory(cat.id, 'skills', e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn-remove-category" 
                    onClick={() => removeCustomCategory(cat.id)}
                    title="Remove category"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Submit Action Bar */}
          <div className="profile-save-action-bar">
            <button 
              type="submit" 
              className="btn btn-save-profile" 
              disabled={isUpdating || formik.isSubmitting}
            >
              {isUpdating || formik.isSubmitting ? (
                <>
                  <span className="pulsating-dot" style={{ backgroundColor: '#ffffff' }}></span>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle /> Save Profile Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
