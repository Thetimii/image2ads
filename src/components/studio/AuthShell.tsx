import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brand, Icon } from "./StudioIcons";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="studio-auth">
      <section
        className="studio-auth-editorial"
        aria-label="Your creative studio"
      >
        <Link href="/" aria-label="Image2Ad home">
          <Brand />
        </Link>
        <div className="studio-auth-editorial-copy">
          <span className="studio-eyebrow">YOUR NEXT CREATIVE CHAPTER.</span>
          <h2>
            Good ideas.
            <br />
            Great <span>possibilities.</span>
          </h2>
          <p>
            A simple product photo. An entirely new perspective.
            <br />
            Let’s see what you can create.
          </p>
        </div>
        <div className="studio-auth-art">
          <div className="studio-auth-orbit" />
          <div className="studio-auth-campaign">
            <Image
              src="/after2.jpg"
              alt="A blue tote bag reimagined in a London lifestyle campaign"
              fill
              sizes="(max-width: 900px) 300px, 40vw"
              priority
            />
            <div>
              <span>THE EVERYDAY, REIMAGINED.</span>
              <strong>
                Everyday.
                <br />
                Extraordinary.
              </strong>
              <span>
                CREATED WITH IMAGE2AD{" "}
                <Icon name="spark" width="16" height="16" />
              </span>
            </div>
          </div>
          <div className="studio-auth-art-tag">
            <Icon name="spark" width="16" height="16" />
            YOUR PRODUCT. A WHOLE NEW SPOTLIGHT.
          </div>
        </div>
        <span className="studio-auth-editorial-footer">
          LESS PRODUCTION. MORE POSSIBILITY.
        </span>
      </section>
      <section className="studio-auth-form-panel">
        <Link
          className="studio-auth-mobile-brand"
          href="/"
          aria-label="Image2Ad home"
        >
          <Brand />
        </Link>
        <div className="studio-auth-form-content">{children}</div>
      </section>
    </main>
  );
}
