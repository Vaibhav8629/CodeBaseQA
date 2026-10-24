import { MotionConfig } from 'framer-motion';
import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorks from '../components/landing/HowItWorks';
import { FinalCta, LandingFooter } from '../components/landing/CtaFooter';
import './landing.css';

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="lp">
        <a className="lp-skip" href="#main">Skip to content</a>
        <LandingNavbar />
        <main id="main">
          <HeroSection />
          <FeaturesSection />
          <HowItWorks />
          <FinalCta />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}