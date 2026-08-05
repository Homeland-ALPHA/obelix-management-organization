import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { Differentiation } from "@/components/landing/Differentiation";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <ModuleIndex />
      <Differentiation />
      <FinalCTA />
    </>
  );
}
