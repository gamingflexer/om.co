import React from "react";
import Socials from "../Socials";
import Link from "next/link";
import Button from "../Button";

const Footer = ({ }) => {
  return (
    <>
      <div className="mt-5 laptop:mt-40 p-2 laptop:p-0">
        <div>
          <h2 className="text-2xl text-bold">Contact.</h2>
          <div className="mt-10">
            <p className="text-3xl tablet:text-6xl laptop:text-6xl laptopl:text-8xl text-bold">
              LET&apos;S WORK
            </p>
            <p className="text-3xl tablet:text-6xl laptop:text-6xl laptopl:text-8xl text-bold">
              TOGETHER
            </p>
            <a href="https://www.linkedin.com/in/om0/" target="_blank" rel="noopener">
              <Button type="primary">Message me on LinkedIn</Button>
            </a>
            <div className="mt-10">
              <Socials />
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm text-bold mt-2 laptop:mt-10 p-2 laptop:p-0">
        Made With ❤ by{" "}
        <Link href="/" legacyBehavior>
          <a className="underline underline-offset-1">Om Surve</a>
        </Link>
      </p>
    </>
  );
};

export default Footer;
