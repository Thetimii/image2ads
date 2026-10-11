import Link from "next/link";
import { Brand, Icon } from "./studio/StudioIcons";
import { Reveal } from "./studio/StudioMotion";

export default function Footer() {
  return (
    <footer className="studio-footer">
      <div className="studio-container">
        <Reveal>
          <div className="studio-footer-cta">
            <div>
              <span className="studio-eyebrow">
                YOUR NEXT GREAT IDEA STARTS HERE.
              </span>
              <h2>
                Ready for your
                <br />
                <span>main character moment?</span>
              </h2>
            </div>
            <Link
              href="/signup"
              className="studio-footer-cta-circle"
              aria-label="Start creating your next campaign"
            >
              <Icon name="diagonal" width="43" height="43" />
              <span>LET’S CREATE</span>
            </Link>
          </div>
        </Reveal>
        <div className="studio-footer-links">
          <div>
            <Link href="/" aria-label="Image2Ad home">
              <Brand />
            </Link>
            <p>A little AI. A whole new perspective.</p>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/about">About</Link>
            <Link href="/blog">Journal</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/signin">
              Your workspace <Icon name="diagonal" width="13" height="13" />
            </Link>
          </nav>
        </div>
        <div className="studio-footer-wordmark" aria-hidden="true">
          good ideas<span>™</span>
        </div>
        <div className="studio-footer-bottom">
          <span>© {new Date().getFullYear()} Image2Ad</span>
          <span>
            MADE FOR YOUR NEXT BIG THING.{" "}
            <Icon name="spark" width="13" height="13" />
          </span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
