/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ArrowRight, ArrowLeft, CreditCard, Printer, ExternalLink, Loader2, CheckCircle2, X, Eye, Menu, ChevronDown, Scroll, Award, History, Search, Users, Database, ShieldCheck, Globe, FileText } from 'lucide-react';
import { supabase } from './lib/supabase';
import { sendEmail } from './services/emailService';
import pricingData from './data/pricing.json';
import testimonialsData from './data/testimonials.json';
import artifactsData from './data/artifacts.json';
import { HERITAGE_BUSINESS } from './config/heritageBusiness';
import { getRoyaltyStats, logPaymentAndCalculateRoyalty } from './services/royaltyService';

export default function App() {
  const [view, setView] = useState<'landing' | 'process' | 'library' | 'form' | 'questionnaire' | 'admin'>('landing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [configMissing, setConfigMissing] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<null | { name: string, subject: string, img: string }>(null);
  const [enquiryArtifact, setEnquiryArtifact] = useState<null | { name: string, subject: string }>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    if (id === 'intro') setView('landing');
    else if (id === 'process') setView('process');
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic Pricing State
  const [pricing, setPricing] = useState(pricingData);
  const [pricingDirty, setPricingDirty] = useState(false);

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'pricing')
        .single();
      
      if (data && data.value) {
        setPricing(data.value);
      } else if (error) {
        console.warn('Pricing not found in Supabase, using local fallback:', error.message);
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleUpdatePricing = async (newPricing: any) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'pricing', value: newPricing }, { onConflict: 'key' });

      if (error) {
        alert(
          '\u274c Save failed: ' + error.message +
          '\n\nCode: ' + error.code +
          '\n\nTo fix, run this once in Supabase SQL Editor:\n' +
          'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);\n' +
          'ALTER TABLE settings DISABLE ROW LEVEL SECURITY;'
        );
        return;
      }

      setPricing(newPricing);
      setPricingDirty(false);
      alert('\u2705 Saved! Price: ' + newPricing.fullPrice + '  |  Deposit: ' + newPricing.deposit);
    } catch (error: any) {
      alert('\u274c Save error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Commission Form State
  const [commissionData, setCommissionData] = useState({
    clientName: '',
    clientEmail: '',
    subjectName: '',
    relationship: '',
    occasion: '',
    commissionDate: new Date().toISOString().split('T')[0]
  });

  // Questionnaire State
  const [questionnaireData, setQuestionnaireData] = useState({
    paternalGrandfather: '',
    paternalGrandfatherBirthplace: '',
    paternalGrandmother: '',
    paternalGrandmotherMaidenName: '',
    maternalGrandfather: '',
    maternalGrandfatherBirthplace: '',
    maternalGrandmother: '',
    maternalGrandmotherMaidenName: '',
    extraGenerations: '',
    narratives: '',
    researchObjectives: '',
    themeColor: '',
    nationality: '',
    motto: ''
  });

  const [promoCode, setPromoCode] = useState('');
  const [isPromoApplied, setIsPromoApplied] = useState(false);

  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryStatus, setEnquiryStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [royaltyStats, setRoyaltyStats] = useState<{ monthTotal: number, ytdTotal: number } | null>(null);
  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);
  const [recentQuestionnaires, setRecentQuestionnaires] = useState<any[]>([]);

  const fetchAdminData = async () => {
    try {
      const stats = await getRoyaltyStats();
      setRoyaltyStats(stats);

      const commissionsRes = await supabase
        .from('commissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRecentCommissions(commissionsRes.data || []);

      const questionnairesRes = await supabase
        .from('questionnaires')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentQuestionnaires(questionnairesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === HERITAGE_BUSINESS.security.dashboardKey) {
      setIsAdminAuthenticated(true);
      fetchAdminData();
    } else {
      alert('Invalid Business Key');
    }
  };

  const handleLogFinalPayment = async (commission: any) => {
    if (commission.final_payment_logged) return;

    const fullPrice = parseInt(pricing.fullPrice.replace(/[^0-9]/g, '')) || 0;
    const deposit = parseInt(pricing.deposit.replace(/[^0-9]/g, '')) || 0;
    const balance = fullPrice - deposit;

    if (balance <= 0) {
      alert('No balance remaining to log.');
      return;
    }

    if (!confirm(`Log final payment of R${balance} for ${commission.client_name}? This will record a royalty of R${balance * HERITAGE_BUSINESS.royalty.percentage}.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      // 1. Log the payment
      await logPaymentAndCalculateRoyalty(balance, commission.client_email);

      // 2. Update commission status
      const { error } = await supabase
        .from('commissions')
        .update({ final_payment_logged: true, status: 'fully_paid' })
        .eq('id', commission.id);

      if (error) throw error;

      alert('Final payment logged and royalty recorded.');
      fetchAdminData(); // Refresh stats
    } catch (error) {
      console.error('Failed to log final payment:', error);
      alert('Error logging payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enquiryArtifact || !enquiryEmail) return;

    setEnquiryStatus('sending');
    try {
      await sendEmail({
        to: HERITAGE_BUSINESS.owner.email,
        subject: `New Enquiry: ${enquiryArtifact.name} Artifact`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1a110a;">
            <h2 style="color: #c5a059;">Artifact Enquiry</h2>
            <p><strong>Artifact:</strong> ${enquiryArtifact.name}</p>
            <p><strong>Subject:</strong> ${enquiryArtifact.subject}</p>
            <p><strong>From:</strong> ${enquiryEmail}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="white-space: pre-wrap;">${enquiryMessage}</p>
          </div>
        `
      });
      setEnquiryStatus('success');
      setTimeout(() => {
        setEnquiryArtifact(null);
        setEnquiryStatus('idle');
        setEnquiryMessage('');
        setEnquiryEmail('');
      }, 2000);
    } catch (error) {
      console.error('Enquiry failed:', error);
      setEnquiryStatus('error');
    }
  };

  const handleCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionData.clientEmail || !commissionData.clientName) {
      alert('Please fill in required fields (Name and Email)');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Submitting commission for:', commissionData.clientEmail);
      const { error } = await supabase
        .from('commissions')
        .insert([{ 
          client_name: commissionData.clientName,
          client_email: commissionData.clientEmail,
          artifact_subject: commissionData.subjectName,
          relationship: commissionData.relationship,
          occasion: commissionData.occasion,
          status: 'pending_payment',
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Supabase Insert Error:', error);
        alert(`Database Error: ${error.message}. Please ensure the 'commissions' table exists in Supabase.`);
        throw error;
      }

      // Log Royalty Payment (using deposit amount)
      const depositAmount = parseInt(pricing.deposit.replace(/[^0-9]/g, '')) || 0;
      await logPaymentAndCalculateRoyalty(depositAmount, commissionData.clientEmail);
      
      // Send Confirmation Email
      console.log('Sending confirmation email...');
      const emailResult = await sendEmail({ 
        to: commissionData.clientEmail, 
        type: 'commission', 
        clientName: commissionData.clientName 
      });
      console.log('Email result:', emailResult);
      
      setSubmitStatus('success');
      setTimeout(() => {
        setSubmitStatus('idle');
        setView('questionnaire');
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting commission:', error);
      setSubmitStatus('error');
      if (!error.message?.includes('Database Error')) {
        alert(`Error submitting form: ${error.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuestionnaireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionData.clientEmail) {
      alert('Please complete the Commission Form first to provide your email address.');
      setView('form');
      return;
    }
    setIsSubmitting(true);
    setSubmitStatus('idle');
    try {
      console.log('Submitting questionnaire for:', commissionData.clientEmail);
      const { error } = await supabase
        .from('questionnaires')
        .insert([{ 
          client_email: commissionData.clientEmail,
          data: questionnaireData,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Supabase Questionnaire Error:', error);
        alert(`Database Error: ${error.message}. Please ensure the 'questionnaires' table exists in Supabase.`);
        throw error;
      }
      
      // Send Questionnaire Received Email
      console.log('Sending questionnaire email...');
      const emailResult = await sendEmail({ 
        to: commissionData.clientEmail, 
        type: 'questionnaire', 
        clientName: commissionData.clientName 
      });
      console.log('Email result:', emailResult);
      
      setSubmitStatus('success');
      alert('Questionnaire submitted successfully! We will begin our research shortly.');
    } catch (error: any) {
      console.error('Error submitting questionnaire:', error);
      setSubmitStatus('error');
      if (!error.message?.includes('Database Error')) {
        alert(`Error submitting questionnaire: ${error.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const [clickCount, setClickCount] = useState(0);
  const handleCopyrightClick = () => {
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setView('admin');
        return 0;
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-heritage-biscuit selection:bg-heritage-gold selection:text-heritage-earth">
      {/* Navigation Bar */}
      <nav className="no-print fixed top-0 left-0 right-0 z-[100] bg-heritage-earth/95 backdrop-blur-md border-b border-heritage-gold/20 h-16 flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div 
            onClick={() => scrollToSection('intro')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 bg-heritage-gold rounded-sm flex items-center justify-center text-heritage-earth font-serif font-bold text-xl group-hover:scale-110 transition-transform">{HERITAGE_BUSINESS.branding.name.charAt(0)}</div>
            <span className="text-heritage-gold font-sans font-bold tracking-[4px] text-xs uppercase hidden sm:block">{HERITAGE_BUSINESS.branding.name}</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToSection('intro')} 
              className={`text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer ${view === 'landing' ? 'text-heritage-gold underline underline-offset-4' : 'text-heritage-gold/70 hover:text-heritage-gold'}`}
            >
              Introduction
            </button>
            <button 
              onClick={() => scrollToSection('process')} 
              className={`text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer ${view === 'process' ? 'text-heritage-gold underline underline-offset-4' : 'text-heritage-gold/70 hover:text-heritage-gold'}`}
            >
              The Process
            </button>
            <button 
              onClick={() => setView('library')} 
              className={`text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer ${view === 'library' ? 'text-heritage-gold underline underline-offset-4' : 'text-heritage-gold/70 hover:text-heritage-gold'}`}
            >
              Library
            </button>
            <button 
              onClick={() => setView('form')}
              className={`px-5 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer ${view === 'form' ? 'bg-heritage-gold text-heritage-earth scale-105' : 'bg-heritage-gold/20 text-heritage-gold hover:bg-heritage-gold hover:text-heritage-earth'}`}
            >
              Commission
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-heritage-gold p-2 cursor-pointer"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-16 left-0 right-0 bg-heritage-earth border-b border-heritage-gold/20 p-6 flex flex-col gap-6 md:hidden"
            >
              <button onClick={() => scrollToSection('intro')} className="text-heritage-gold text-sm uppercase tracking-widest font-bold text-left">Introduction</button>
              <button onClick={() => scrollToSection('process')} className="text-heritage-gold text-sm uppercase tracking-widest font-bold text-left">The Process</button>
              <button 
                onClick={() => {
                  setView('library');
                  setIsMenuOpen(false);
                }} 
                className="text-heritage-gold text-sm uppercase tracking-widest font-bold text-left"
              >
                Library
              </button>
              <button 
                onClick={() => {
                  setView('form');
                  setIsMenuOpen(false);
                }}
                className="w-full py-3 bg-heritage-gold text-heritage-earth rounded-full text-sm uppercase tracking-widest font-bold"
              >
                Commission
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="pt-16">
        {/* Artifact Preview Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-8">
          <div 
            className="absolute inset-0 bg-heritage-earth/95 backdrop-blur-md"
            onClick={() => setSelectedArtifact(null)}
          ></div>
          <div className="relative w-full max-w-4xl bg-heritage-biscuit rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-4 border-heritage-gold/30">
            <div className="p-4 border-b border-black/10 flex items-center justify-between bg-white/50">
              <div>
                <h3 className="font-bold uppercase tracking-widest text-sm">{selectedArtifact.name}</h3>
                <p className="text-[10px] italic opacity-70">Front Page Preview • {selectedArtifact.subject}</p>
              </div>
              <button 
                onClick={() => setSelectedArtifact(null)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-black/5 flex justify-center relative group/preview">
              <div className="relative shadow-2xl border border-black/10 max-w-full">
                <img 
                  src={selectedArtifact.img} 
                  alt={selectedArtifact.name}
                  className="max-w-full h-auto block"
                  onError={(e) => {
                    e.currentTarget.src = 'https://picsum.photos/seed/heritage/800/1200?blur=2';
                  }}
                />
                <div className="absolute inset-0 pointer-events-none border-[20px] border-white/5 mix-blend-overlay"></div>
                
                {/* Sample Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <div className="text-heritage-gold/10 text-[15vw] font-bold uppercase tracking-[2em] -rotate-45 whitespace-nowrap select-none">
                    SAMPLE
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-heritage-earth text-heritage-gold text-center space-y-3">
              <p className="text-xs italic opacity-90 max-w-2xl mx-auto">
                "This preview represents the quality and narrative depth of our bespoke artifacts. The full document contains verified lineages, historical context, and personal tributes."
              </p>
              <div className="flex justify-center gap-4 pt-2">
                <button 
                  onClick={() => setSelectedArtifact(null)}
                  className="px-6 py-2 border border-heritage-gold/30 rounded-full text-[10px] uppercase tracking-widest hover:bg-heritage-gold/10 transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
                <button 
                  onClick={() => {
                    setEnquiryArtifact(selectedArtifact);
                    setSelectedArtifact(null);
                  }}
                  className="px-6 py-2 bg-heritage-earth text-heritage-gold rounded-full text-[10px] uppercase tracking-widest font-bold hover:scale-105 transition-transform cursor-pointer"
                >
                  Enquire about this
                </button>
                <button 
                  onClick={() => {
                    setSelectedArtifact(null);
                    setView('form');
                  }}
                  className="px-6 py-2 bg-heritage-gold text-heritage-earth rounded-full text-[10px] uppercase tracking-widest font-bold hover:scale-105 transition-transform cursor-pointer"
                >
                  Commission Your Own
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enquiry Modal */}
      {enquiryArtifact && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-heritage-earth/95 backdrop-blur-md" onClick={() => setEnquiryArtifact(null)}></div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-heritage-biscuit rounded-xl shadow-2xl overflow-hidden border border-heritage-gold/30"
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold uppercase tracking-widest text-sm">Enquire about Artifact</h3>
                  <p className="text-[10px] italic opacity-70">{enquiryArtifact.name} • {enquiryArtifact.subject}</p>
                </div>
                <button onClick={() => setEnquiryArtifact(null)} className="p-1 hover:bg-black/5 rounded-full transition-colors"><X size={20} /></button>
              </div>

              {enquiryStatus === 'success' ? (
                <div className="py-12 text-center space-y-4">
                  <CheckCircle2 className="mx-auto text-green-600" size={48} />
                  <p className="font-bold uppercase tracking-widest text-xs">Enquiry Sent Successfully</p>
                  <p className="text-[10px] italic opacity-70">Tommy will be in touch shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleEnquirySubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider">Your Email Address:</label>
                    <input 
                      required
                      type="email"
                      value={enquiryEmail}
                      onChange={(e) => setEnquiryEmail(e.target.value)}
                      className="w-full bg-transparent border-b border-black/20 focus:border-black outline-none py-1 text-xs"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider">Your Message:</label>
                    <textarea 
                      required
                      value={enquiryMessage}
                      onChange={(e) => setEnquiryMessage(e.target.value)}
                      className="w-full bg-transparent border border-black/10 rounded p-2 focus:border-black outline-none text-xs h-32 resize-none"
                      placeholder="I am also a relative of the Lupini family and would like to connect..."
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={enquiryStatus === 'sending'}
                    className="w-full py-3 bg-heritage-gold text-heritage-earth rounded-full text-[10px] uppercase tracking-widest font-bold hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    {enquiryStatus === 'sending' ? 'Sending...' : 'Send Enquiry'}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {configMissing && (
        <div className="no-print fixed bottom-4 left-4 z-[9999] bg-red-900 text-white px-4 py-2 rounded-lg shadow-2xl border border-red-700 text-xs font-sans animate-pulse">
          ⚠️ Supabase Configuration Missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
        </div>
      )}

      <div className={`${view === 'landing' ? 'flex print:flex' : 'hidden'} flex-col heritage-export-page`}>
        <div id="heritage-protocol-view" className="relative flex-1 flex flex-col bg-heritage-biscuit min-h-screen">
          {/* Header Banner */}
          <div className="w-full border-b-4 border-heritage-gold z-10">
            <img 
              src="/heritage-banner.png" 
              alt="Heritage Banner" 
              className="w-full h-auto block"
            />
          </div>

          {/* Introduction Section */}
          <section className="flex-1 flex flex-col items-center pt-12 pb-12 print:pt-4 print:pb-8">
            <div className="px-6 flex items-center justify-center">
              <div className="max-w-4xl text-center space-y-8">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <p className="text-heritage-midnight text-2xl md:text-3xl font-serif leading-relaxed italic">
                    Family history shouldn't be trapped in databases that can't capture the essence of who people were.
                  </p>
                  <p className="text-heritage-midnight text-2xl md:text-3xl font-serif leading-relaxed italic">
                    Heritage documents should be living tributes — beautiful, personal, and unforgettable.
                  </p>
                  <p className="text-heritage-midnight text-3xl md:text-4xl font-serif font-bold pt-4 tracking-tight">
                    HERITAGE™ transforms genealogy data into meaningful artifacts.
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="w-full px-6 flex flex-col items-center mt-12 print-avoid-break">
              <div className="bg-heritage-earth text-heritage-gold px-10 py-8 rounded-xl shadow-2xl max-w-4xl text-center border border-heritage-gold/40 space-y-4">
                <p className="text-lg md:text-2xl font-serif leading-relaxed italic">
                  "This Heritage artifact was designed, narrated, and compiled by {HERITAGE_BUSINESS.owner.name}, with profound respect for, and a deep appreciation of, Heritage and Genealogy."
                </p>
                <div className="pt-3 border-t border-heritage-gold/20">
                  <p className="text-heritage-gold font-sans text-xs md:text-sm uppercase tracking-[8px] font-bold">
                    {HERITAGE_BUSINESS.owner.email}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="bg-heritage-earth py-4 px-6 border-t border-heritage-gold/20 text-center">
            <div className="max-w-4xl mx-auto space-y-1">
              <p className="text-heritage-gold/60 font-sans text-[8px] md:text-[9px] uppercase tracking-[3px] leading-relaxed">
                {HERITAGE_BUSINESS.branding.name} is a proprietary intellectual property. Unauthorized reproduction, distribution, or commercial use is strictly prohibited.
              </p>
              <p 
                onClick={handleCopyrightClick}
                className="text-heritage-gold font-bold font-sans text-[8px] md:text-[9px] uppercase tracking-[1px] cursor-pointer select-none"
              >
                {HERITAGE_BUSINESS.branding.copyright}
              </p>
            </div>
          </footer>
        </div>
      </div>

      <div className={`${view === 'process' ? 'flex print:flex' : 'hidden'} flex-col heritage-export-page`}>
        <div className="relative flex-1 flex flex-col bg-heritage-biscuit min-h-screen">
          {/* Header Banner */}
          <div className="w-full border-b-4 border-heritage-gold z-10">
             <img 
              src="/heritage-banner.png" 
              alt="Heritage Banner" 
              className="w-full h-auto block"
            />
          </div>
          <section className="flex-1 py-12 px-6">
            <div className="max-w-6xl mx-auto space-y-24 text-heritage-earth">
               <div className="text-center space-y-6">
                  <h2 className="text-heritage-midnight text-sm font-bold uppercase tracking-[0.4em]">The Heritage Protocol</h2>
                  <div className="w-16 h-1 bg-heritage-gold mx-auto"></div>
                  <p className="text-heritage-midnight/60 italic text-sm">Three stages to an everlasting tribute.</p>
               </div>

               <div className="grid md:grid-cols-3 gap-12 relative">
                  <div className="hidden md:block absolute top-1/2 left-32 right-32 h-px bg-heritage-gold/20 -translate-y-1/2 -z-0"></div>
                  {[
                    { step: '01', title: 'Commission', icon: Scroll, desc: `Engagement starts with your vision.`, meta: `Secure Fee: ${pricing.deposit}` },
                    { step: '02', title: 'Acquisition', icon: Search, desc: `We research records, verify lineages, and audit archives.`, meta: '7-14 Days Research' },
                    { step: '03', title: 'Artifact', icon: Award, desc: `The design is finalized and your artifact is delivered.`, meta: 'Heirloom Quality', price: pricing.fullPrice },
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ y: -5 }}
                      className="relative bg-white p-10 rounded-3xl border border-heritage-gold/20 shadow-xl text-center space-y-6 z-10"
                    >
                      <div className="w-16 h-16 bg-heritage-gold rounded-full flex items-center justify-center mx-auto text-heritage-earth shadow-lg">
                        <item.icon size={28} />
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-bold text-heritage-earth uppercase tracking-widest text-sm">{item.title}</h4>
                        <p className="text-heritage-earth/80 text-base leading-relaxed">{item.desc}</p>
                        {item.price && (
                          <p className="text-3xl font-serif font-bold text-heritage-midnight tracking-tight">{item.price}</p>
                        )}
                        <div className="pt-4 border-t border-heritage-gold/10">
                          <p className="text-sm font-bold uppercase tracking-widest text-heritage-gold">{item.meta}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
               </div>

               <div className="bg-white rounded-[3rem] p-12 border border-heritage-gold/10 space-y-12 shadow-sm">
                 <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                   <div className="space-y-3">
                     <h3 className="text-3xl font-serif text-heritage-midnight italic">Curated Artifact Glimpse</h3>
                     <p className="text-xs opacity-60 uppercase tracking-widest">Shared examples from our growing archive</p>
                   </div>
                   <button onClick={() => setView('library')} className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest hover:text-heritage-gold transition-colors group">
                     Visit Full Library <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                   </button>
                 </div>

                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                   {artifactsData.slice(0, 4).map((art) => (
                     <div key={art.id} className="relative group aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-heritage-gold/20">
                       <img src={art.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                       <div className="absolute inset-0 bg-gradient-to-t from-heritage-earth via-heritage-earth/20 to-transparent flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-[10px] font-bold uppercase tracking-widest mb-3">{art.name}</p>
                          <div className="flex gap-2">
                             <button onClick={() => setSelectedArtifact(art)} className="flex-1 py-2 bg-heritage-gold text-heritage-earth text-[8px] font-bold uppercase rounded hover:bg-white transition-colors">View</button>
                             <button onClick={() => { setEnquiryArtifact(art); }} className="flex-1 py-2 bg-white/10 text-white backdrop-blur-md text-[8px] font-bold uppercase rounded border border-white/20 hover:bg-white hover:text-heritage-earth transition-all">Enquire</button>
                          </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </section>
        </div>
      </div>

      <section className={`${view === 'library' ? 'block' : 'hidden'} min-h-screen bg-heritage-biscuit py-32 px-6`}>
         <div className="max-w-6xl mx-auto space-y-24 text-heritage-earth">
           <div className="text-center space-y-6">
             <h2 className="text-heritage-midnight text-3xl font-serif italic tracking-tight">The Heritage Artifact Library</h2>
             <div className="w-24 h-1 bg-heritage-gold mx-auto"></div>
             <p className="text-heritage-midnight/50 text-xs uppercase tracking-widest">Selected Works & Client Testimonials</p>
           </div>

           <div className="grid lg:grid-cols-3 gap-16">
             <div className="lg:col-span-1 space-y-10">
               <h3 className="font-bold uppercase tracking-widest text-sm border-b border-heritage-gold/10 pb-4 flex items-center gap-3">
                 <Scroll size={18} /> Client Stories
               </h3>
               <div className="space-y-6">
                  { testimonialsData.map(t => (
                    <div key={t.id} className="relative bg-white p-8 rounded-2xl italic text-sm leading-relaxed border border-heritage-gold/10 shadow-sm">
                      <span className="absolute top-4 left-4 text-4xl text-heritage-gold opacity-20">"</span>
                      {t.text}
                      <p className="mt-4 not-italic font-bold text-[9px] uppercase tracking-widest opacity-60">— {t.author}</p>
                    </div>
                  ))}
               </div>
             </div>

             <div className="lg:col-span-2 space-y-10">
               <h3 className="font-bold uppercase tracking-widest text-sm border-b border-heritage-gold/10 pb-4 flex items-center gap-3">
                 <Database size={18} /> The Collection
               </h3>
               <div className="grid sm:grid-cols-2 gap-8">
                 { artifactsData.map(art => (
                   <div 
                    key={art.id} 
                    onClick={() => setSelectedArtifact(art)}
                    className="group cursor-pointer bg-white text-heritage-earth rounded-2xl overflow-hidden border border-heritage-gold/20 hover:border-heritage-gold transition-all duration-500 shadow-2xl flex flex-col"
                   >
                     <div className="h-48 overflow-hidden relative border-b border-heritage-gold/10">
                       <img src={art.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                       <div className="absolute inset-0 bg-heritage-earth/5 group-hover:bg-transparent transition-colors"></div>
                     </div>
                     <div className="p-6 space-y-2 flex-1 flex flex-col justify-between">
                       <div>
                          <p className="font-bold uppercase tracking-widest text-xs">{art.name}</p>
                          <p className="text-[10px] italic opacity-60">Subject: {art.subject}</p>
                       </div>
                       <div className="pt-4 flex justify-between items-center opacity-40 group-hover:opacity-100">
                         <span className="text-[9px] uppercase tracking-widest flex items-center gap-1"><Eye size={12}/> Inspect Detail</span>
                         <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
         </div>
      </section>

      <section className={`${view === 'form' ? 'block' : 'hidden'} min-h-screen bg-heritage-biscuit py-32 px-6`}>
         <div className="max-w-4xl mx-auto space-y-16 text-heritage-earth">
           <div className="text-center space-y-6">
              <h2 className="text-3xl font-serif text-heritage-midnight italic">Commission Your Artifact</h2>
              <div className="w-20 h-1 bg-heritage-gold mx-auto"></div>
              <p className="text-xs uppercase tracking-widest opacity-60">Enter the Heritage Protocol Queue</p>
           </div>

           <div className="bg-white rounded-[2.5rem] p-8 md:p-16 border border-heritage-gold/10 shadow-2xl space-y-12">
             <form onSubmit={handleCommissionSubmit} className="space-y-12">
               <div className="grid md:grid-cols-2 gap-10">
                 <div className="space-y-2">
                   <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Client Identity / Name</label>
                   <input required value={commissionData.clientName} onChange={e => setCommissionData({...commissionData, clientName: e.target.value})} placeholder="Thomas Moore" className="w-full bg-transparent border-b border-heritage-gold/20 py-3 text-sm focus:border-heritage-gold outline-none transition-colors" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Secure Email for Artifact Delivery</label>
                   <input required type="email" value={commissionData.clientEmail} onChange={e => setCommissionData({...commissionData, clientEmail: e.target.value})} placeholder="moore@family.com" className="w-full bg-transparent border-b border-heritage-gold/20 py-3 text-sm focus:border-heritage-gold outline-none transition-colors" />
                 </div>
               </div>

               <div className="grid md:grid-cols-3 gap-8">
                 <div className="space-y-2">
                   <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Artifact Subject Name</label>
                   <input value={commissionData.subjectName} onChange={e => setCommissionData({...commissionData, subjectName: e.target.value})} placeholder="Surname / Lineage" className="w-full bg-transparent border-b border-heritage-gold/20 py-3 text-sm focus:border-heritage-gold outline-none" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Your Relationship</label>
                   <input value={commissionData.relationship} onChange={e => setCommissionData({...commissionData, relationship: e.target.value})} placeholder="e.g. Descendant" className="w-full bg-transparent border-b border-heritage-gold/20 py-3 text-sm focus:border-heritage-gold outline-none" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Occasion / Deadline</label>
                   <input value={commissionData.occasion} onChange={e => setCommissionData({...commissionData, occasion: e.target.value})} placeholder="e.g. Birthday / August" className="w-full bg-transparent border-b border-heritage-gold/20 py-3 text-sm focus:border-heritage-gold outline-none" />
                 </div>
               </div>

               <div className="pt-8 border-t border-heritage-gold/10 space-y-8">
                 <div className="flex flex-col md:flex-row justify-between gap-10">
                   <div className="space-y-4 max-w-sm">
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-heritage-earth">Payment Authorization</h4>
                     <p className="text-xs italic leading-relaxed opacity-60">Engagement requires a non-refundable deposit to commence archival research and design drafting.</p>
                     <div className="bg-heritage-earth/5 p-4 rounded-xl space-y-2 border border-heritage-gold/10">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-heritage-earth/60">EFT Bank Code: {HERITAGE_BUSINESS.payment.eft.bank}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-heritage-earth/60">Account: {HERITAGE_BUSINESS.payment.eft.accountNumber}</p>
                        <div className="pt-2">
                           <a 
                             href={HERITAGE_BUSINESS.payment.yoco.link} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="w-full bg-[#00adef] text-white py-2 rounded font-bold text-[8px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#0091c9] transition-colors"
                           >
                             <CreditCard size={12} /> Pay with Yoco
                           </a>
                        </div>
                      </div>
                   </div>
                   <div className="flex-1 flex flex-col gap-4 text-center">
                      <div className="bg-heritage-earth text-heritage-gold p-8 rounded-3xl shadow-2xl border border-heritage-gold/30">
                         <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Commission Deposit (ZA)</p>
                         <p className="text-4xl font-bold tracking-tighter mb-6">{pricing.deposit}</p>
                         <button 
                          disabled={isSubmitting}
                          className="w-full py-4 bg-heritage-gold text-heritage-earth rounded-full text-xs font-bold tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-105 hover:bg-white transition-all disabled:opacity-50"
                         >
                           {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (
                             <>Confirm Commission <ArrowRight size={18} /></>
                           )}
                         </button>
                      </div>
                      <p className="text-[9px] italic opacity-40">By clicking confirm, you agree to our heritage preservation standards.</p>
                   </div>
                 </div>
               </div>
             </form>
           </div>
         </div>
      </section>

      <section className={`${view === 'questionnaire' ? 'block' : 'hidden'} min-h-screen bg-heritage-biscuit py-32 px-6`}>
         <div className="max-w-4xl mx-auto space-y-16 text-heritage-earth">
           <div className="text-center space-y-6">
              <h2 className="text-3xl font-serif text-heritage-midnight italic">Heritage Questionnaire</h2>
              <div className="w-32 h-1 bg-heritage-gold mx-auto"></div>
              <p className="text-xs uppercase tracking-widest opacity-60">Archival Record Acquisition</p>
           </div>

           {!commissionData.clientEmail ? (
             <div className="bg-white p-20 rounded-[3rem] text-center space-y-8 border border-heritage-gold/10 shadow-sm">
               <History size={48} className="mx-auto text-heritage-gold/40" />
               <p className="text-lg italic opacity-60">Archival access requires an active commission.</p>
               <button onClick={() => setView('form')} className="px-10 py-4 bg-heritage-gold text-heritage-earth rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:scale-105">Return to Commission</button>
             </div>
           ) : (
             <div className="bg-white rounded-[3rem] p-8 md:p-16 border border-heritage-gold/10 shadow-2xl">
               <form onSubmit={handleQuestionnaireSubmit} className="space-y-16">
                 <div className="space-y-10">
                   <div className="flex items-center gap-4">
                     <h3 className="font-bold uppercase tracking-[0.3em] text-[10px] text-heritage-earth">01. Direct Lineage</h3>
                     <div className="flex-1 h-px bg-heritage-gold/20"></div>
                   </div>
                   <div className="grid md:grid-cols-2 gap-10">
                      <div className="space-y-4">
                         <h4 className="text-[9px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-2"><Users size={14}/> Paternal Branch</h4>
                         <div className="space-y-1">
                           <label className="text-[10px] opacity-40 uppercase">Paternal Grandfather</label>
                           <input placeholder="Name & Origin" value={questionnaireData.paternalGrandfather} onChange={e => setQuestionnaireData({...questionnaireData, paternalGrandfather: e.target.value})} className="w-full bg-transparent border-b border-heritage-gold/20 py-2 text-sm outline-none" />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] opacity-40 uppercase">Paternal Grandmother</label>
                           <input placeholder="Name & Origin" value={questionnaireData.paternalGrandmother} onChange={e => setQuestionnaireData({...questionnaireData, paternalGrandmother: e.target.value})} className="w-full bg-transparent border-b border-heritage-gold/20 py-2 text-sm outline-none" />
                         </div>
                      </div>
                      <div className="space-y-4">
                         <h4 className="text-[9px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-2"><Users size={14}/> Maternal Branch</h4>
                         <div className="space-y-1">
                           <label className="text-[10px] opacity-40 uppercase">Maternal Grandfather</label>
                           <input placeholder="Name & Origin" value={questionnaireData.maternalGrandfather} onChange={e => setQuestionnaireData({...questionnaireData, maternalGrandfather: e.target.value})} className="w-full bg-transparent border-b border-heritage-gold/20 py-2 text-sm outline-none" />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] opacity-40 uppercase">Maternal Grandmother</label>
                           <input placeholder="Name & Origin" value={questionnaireData.maternalGrandmother} onChange={e => setQuestionnaireData({...questionnaireData, maternalGrandmother: e.target.value})} className="w-full bg-transparent border-b border-heritage-gold/20 py-2 text-sm outline-none" />
                         </div>
                      </div>
                   </div>
                 </div>

                 <div className="space-y-10">
                   <div className="flex items-center gap-4">
                     <h3 className="font-bold uppercase tracking-[0.3em] text-[10px] text-heritage-earth">02. Narratives & Objective</h3>
                     <div className="flex-1 h-px bg-heritage-gold/20"></div>
                   </div>
                   <div className="space-y-8">
                     <div className="space-y-3">
                       <label className="text-[9px] font-bold uppercase tracking-widest opacity-60">Known Great-Grandparents / Regions of Origin</label>
                       <textarea value={questionnaireData.extraGenerations} onChange={e => setQuestionnaireData({...questionnaireData, extraGenerations: e.target.value})} className="w-full bg-transparent border border-heritage-gold/20 rounded-xl p-4 text-sm h-32 focus:border-heritage-gold transition-colors outline-none resize-none" placeholder="Include any known 3rd or 4th generations..." />
                     </div>
                     <div className="space-y-3">
                       <label className="text-[9px] font-bold uppercase tracking-widest opacity-60">Key Family Stories / Heroics / Trivia</label>
                       <textarea value={questionnaireData.narratives} onChange={e => setQuestionnaireData({...questionnaireData, narratives: e.target.value})} className="w-full bg-transparent border border-heritage-gold/20 rounded-xl p-4 text-sm h-32 focus:border-heritage-gold transition-colors outline-none resize-none" placeholder="Military service, pioneering events, cultural traditions..." />
                     </div>
                     <div className="space-y-3">
                       <label className="text-[9px] font-bold uppercase tracking-widest opacity-60">Research Objectives</label>
                       <textarea value={questionnaireData.researchObjectives} onChange={e => setQuestionnaireData({...questionnaireData, researchObjectives: e.target.value})} className="w-full bg-transparent border border-heritage-gold/20 rounded-xl p-4 text-sm h-32 focus:border-heritage-gold transition-colors outline-none resize-none" placeholder="What specific questions do you want answered about your history?" />
                     </div>
                   </div>
                 </div>

                 <button disabled={isSubmitting} className="w-full py-5 bg-heritage-earth text-heritage-gold rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4 hover:scale-105 transition-all disabled:opacity-50">
                   {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                     <><FileText size={20} /> Submit Archival Data</>
                   )}
                 </button>
               </form>
             </div>
           )}
         </div>
       </section>

          {/* Admin / Royalty Dashboard */}
      <div className={`${view === 'admin' ? 'flex' : 'hidden'} flex-col bg-heritage-earth min-h-screen text-heritage-gold p-8`}>
        <div className="max-w-4xl mx-auto w-full space-y-8">
          <div className="flex justify-between items-center border-b border-heritage-gold/20 pb-4">
            <h2 className="text-2xl font-bold uppercase tracking-[0.2em]">Business Dashboard</h2>
            <div className="flex items-center gap-3">
              {pricingDirty && (
                <span className="text-[9px] uppercase tracking-widest text-amber-400 animate-pulse">
                  ● Unsaved changes
                </span>
              )}
              <button
                onClick={async () => {
                  if (pricingDirty) {
                    await handleUpdatePricing(pricing);
                  }
                  setView('landing');
                }}
                className="text-[10px] uppercase tracking-widest font-bold border border-heritage-gold/30 px-4 py-2 rounded-full hover:bg-heritage-gold/10 transition-colors"
              >
                {pricingDirty ? 'Save & Exit' : 'Exit Dashboard'}
              </button>
            </div>
          </div>

          {!isAdminAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <CreditCard size={48} className="opacity-20" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold uppercase tracking-widest">Secure Access Required</h3>
                <p className="text-xs italic opacity-60">Enter the Heritage Business Key to view royalty reports.</p>
              </div>
              <form onSubmit={handleAdminLogin} className="flex flex-col items-center gap-4 w-full max-w-xs">
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter Business Key"
                  className="w-full bg-transparent border-b border-heritage-gold/30 focus:border-heritage-gold outline-none py-2 text-center text-lg tracking-[0.5em]"
                />
                <button 
                  type="submit"
                  className="w-full py-3 bg-heritage-gold text-heritage-earth rounded-full text-[10px] uppercase tracking-widest font-bold hover:scale-105 transition-transform"
                >
                  Access Reports
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white/5 p-8 rounded-2xl border border-heritage-gold/10 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest opacity-60">Monthly Royalties</p>
                  <p className="text-4xl font-bold">R {royaltyStats?.monthTotal.toFixed(2) || '0.00'}</p>
                  <p className="text-[10px] italic opacity-40">Calculated at {HERITAGE_BUSINESS.royalty.percentage * 100}% of gross income</p>
                </div>
                <div className="bg-white/5 p-8 rounded-2xl border border-heritage-gold/10 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest opacity-60">YTD Accumulated Balance</p>
                  <p className="text-4xl font-bold">R {royaltyStats?.ytdTotal.toFixed(2) || '0.00'}</p>
                  <p className="text-[10px] italic opacity-40">Year to Date: {new Date().getFullYear()}</p>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-heritage-gold/10 pb-2">Recent Commissions & Final Payments</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="opacity-40 uppercase tracking-tighter text-[9px] border-b border-heritage-gold/5">
                        <th className="py-2">Date</th>
                        <th className="py-2">Client</th>
                        <th className="py-2">Subject</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-heritage-gold/5">
                      {recentCommissions.map((c) => (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3">{new Date(c.created_at).toLocaleDateString()}</td>
                          <td className="py-3">
                            <p className="font-bold">{c.client_name}</p>
                            <p className="opacity-60">{c.client_email}</p>
                          </td>
                          <td className="py-3 italic">{c.artifact_subject}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase font-bold ${c.final_payment_logged ? 'bg-green-500/20 text-green-400' : 'bg-heritage-gold/20 text-heritage-gold'}`}>
                              {c.final_payment_logged ? 'Fully Paid' : 'Deposit Paid'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {!c.final_payment_logged && (
                              <button 
                                onClick={() => handleLogFinalPayment(c)}
                                disabled={isSubmitting}
                                className="bg-heritage-gold text-heritage-earth px-3 py-1 rounded text-[8px] font-bold uppercase hover:scale-105 transition-transform disabled:opacity-50"
                              >
                                Log Final Payment
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {recentCommissions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center italic opacity-40">No commissions found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-heritage-gold/10 pb-2">Archival Questionnaire Submissions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="opacity-40 uppercase tracking-tighter text-[9px] border-b border-heritage-gold/5">
                        <th className="py-2">Date</th>
                        <th className="py-2">Client</th>
                        <th className="py-2">Main Lineage</th>
                        <th className="py-2 text-right">Research Objective</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-heritage-gold/5">
                      {recentQuestionnaires.map((q) => (
                        <tr key={q.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 whitespace-nowrap">{new Date(q.created_at).toLocaleDateString()}</td>
                          <td className="py-3 italic">{q.client_email}</td>
                          <td className="py-3">
                            <p className="font-bold opacity-80">{q.data.paternalGrandfather} & {q.data.maternalGrandfather}</p>
                          </td>
                          <td className="py-3 text-right max-w-xs truncate italic opacity-50">{q.data.researchObjectives}</td>
                        </tr>
                      ))}
                      {recentQuestionnaires.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-10 text-center italic opacity-40">No questionnaire data archived.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-heritage-gold/10 pb-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Seasonal Pricing & Promotions</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-[9px] uppercase tracking-widest opacity-40">Live Status</span>
                     <div className={`w-2 h-2 rounded-full ${pricing.showPromo ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                  </div>
                </div>
                <div className="bg-white/5 p-8 rounded-2xl border border-heritage-gold/10 grid md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest opacity-40">Main Artifact Price</label>
                      <input 
                        className="w-full bg-transparent border-b border-heritage-gold/20 py-2 outline-none focus:border-heritage-gold text-lg font-serif"
                        value={pricing.fullPrice}
                        onChange={e => { setPricing({...pricing, fullPrice: e.target.value}); setPricingDirty(true); }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest opacity-40">Deposit Amount (Display)</label>
                      <input 
                        className="w-full bg-transparent border-b border-heritage-gold/20 py-2 outline-none focus:border-heritage-gold text-lg font-serif"
                        value={pricing.deposit}
                        onChange={e => { setPricing({...pricing, deposit: e.target.value}); setPricingDirty(true); }}
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest opacity-40">Promo Code</label>
                        <input 
                          className="w-full bg-transparent border-b border-heritage-gold/20 py-2 outline-none focus:border-heritage-gold font-bold tracking-widest uppercase"
                          value={pricing.promoCode}
                          onChange={e => { setPricing({...pricing, promoCode: e.target.value.toUpperCase()}); setPricingDirty(true); }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest opacity-40">Discount %</label>
                        <input 
                          className="w-full bg-transparent border-b border-heritage-gold/20 py-2 outline-none focus:border-heritage-gold font-bold"
                          value={pricing.promoDiscount}
                          onChange={e => { setPricing({...pricing, promoDiscount: e.target.value}); setPricingDirty(true); }}
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex items-center justify-between bg-heritage-gold/5 p-4 rounded-xl border border-heritage-gold/10">
                       <span className="text-[10px] uppercase tracking-widest opacity-60">Display Promo Banner</span>
                       <button 
                        onClick={() => { setPricing({...pricing, showPromo: !pricing.showPromo}); setPricingDirty(true); }}
                        className={`w-12 h-6 rounded-full transition-all relative ${pricing.showPromo ? 'bg-heritage-gold' : 'bg-white/10'}`}
                       >
                         <div className={`absolute top-1 w-4 h-4 rounded-full bg-heritage-earth shadow-sm transition-all ${pricing.showPromo ? 'left-7' : 'left-1'}`}></div>
                       </button>
                    </div>
                  </div>
                  <div className="md:col-span-2 pt-4">
                    <button 
                      onClick={() => handleUpdatePricing(pricing)}
                      disabled={isSubmitting}
                      className="w-full py-5 bg-heritage-gold text-heritage-earth rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.01] transition-all shadow-xl active:scale-[0.99] disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                      Archive Seasonal Pricing Updates
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-xs">
                  <div className="space-y-1">
                    <p className="opacity-40 uppercase tracking-tighter text-[9px]">Current Owner</p>
                    <p className="font-bold">{HERITAGE_BUSINESS.owner.fullName}</p>
                    <p className="opacity-60">{HERITAGE_BUSINESS.owner.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="opacity-40 uppercase tracking-tighter text-[9px]">Royalty Recipient</p>
                    <p className="font-bold">{HERITAGE_BUSINESS.royalty.recipientEmail}</p>
                    <p className="opacity-60">Fixed Rate: {HERITAGE_BUSINESS.royalty.percentage * 100}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="opacity-40 uppercase tracking-tighter text-[9px]">Bank Account</p>
                    <p className="font-bold">{HERITAGE_BUSINESS.payment.eft.bank}</p>
                    <p className="opacity-60">{HERITAGE_BUSINESS.payment.eft.accountNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="opacity-40 uppercase tracking-tighter text-[9px]">Yoco Payment Page</p>
                    <p className="font-bold truncate max-w-[150px]">{HERITAGE_BUSINESS.payment.yoco.link.replace('https://', '')}</p>
                  </div>
                </div>
                <div className="pt-8 text-center">
                  <p className="text-[10px] italic opacity-40 max-w-md mx-auto">
                    "This dashboard is for internal business monitoring only. Monthly statements are automatically generated and sent to {HERITAGE_BUSINESS.royalty.recipientEmail} on the last day of each month."
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>    

      </div>

      {/* --- GLOBAL FOOTER --- */}
      <footer className="bg-heritage-earth py-12 px-6 border-t border-heritage-gold/10 text-center no-print">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-6 mb-6 opacity-30">
             <Globe size={18} className="text-heritage-gold" />
             <div className="w-12 h-px bg-heritage-gold"></div>
             <Database size={18} className="text-heritage-gold" />
             <div className="w-12 h-px bg-heritage-gold"></div>
             <ShieldCheck size={18} className="text-heritage-gold" />
          </div>
          <p className="text-heritage-gold/40 font-sans text-[8px] md:text-[9px] uppercase tracking-[3px] font-bold mb-4">{HERITAGE_BUSINESS.branding.name}</p>
          <p 
            onClick={handleCopyrightClick}
            className="text-heritage-gold font-bold font-sans text-[8px] md:text-[9px] uppercase tracking-[1px] cursor-pointer select-none"
          >
            {HERITAGE_BUSINESS.branding.copyright}
          </p>
          <div className="pt-6 flex justify-center gap-8 text-[9px] uppercase tracking-widest text-heritage-gold/30">
             <span className="flex items-center gap-1"><Printer size={10}/> Heirlooms Built to Last</span>
             <span className="flex items-center gap-1"><Mail size={10}/> Delivered Globally</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
