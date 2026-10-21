import React from 'react';
import HeroSection from '../components/HeroSection';
import CapabilitiesGrid from '../components/CapabilitiesGrid';
import IndustriesShowcase from '../components/IndustriesShowcase';
import HowItWorksSteps from '../components/HowItWorksSteps';
import ConnectionOptionsSection from '../components/ConnectionOptionsSection';
import DataIsolationSection from '../components/DataIsolationSection';
import CTASection from '../components/CTASection';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <CapabilitiesGrid />
      <IndustriesShowcase />
      <HowItWorksSteps />
      <ConnectionOptionsSection />
      <DataIsolationSection />
      <CTASection />
    </div>
  );
}
