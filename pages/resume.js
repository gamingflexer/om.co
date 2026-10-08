import React, { useEffect } from "react";
import { useRouter } from "next/router";
import Cursor from "../components/Cursor";
import Header from "../components/Header";
import ProjectResume from "../components/ProjectResume";
import Socials from "../components/Socials";
import Button from "../components/Button";
import Seo from "../components/Seo";
// Data
import portfolioData from "../data/portfolio.json";

const { name, showResume, resume } = portfolioData;

const Resume = () => {
  const router = useRouter();
  useEffect(() => {
    if (!showResume) {
      router.push("/");
    }
  }, []);
  return (
    <>
      <Seo
        title={`Resume | ${name}`}
        description={resume.description}
        path="/resume/"
        noindex={!showResume}
      />
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-6 right-6">
          <Button onClick={() => router.push("/edit")} type={"primary"}>
            Edit Resume
          </Button>
        </div>
      )}

      <Cursor />
      <div className="container mx-auto cursor-none mb-10 bg-white min-h-screen">
        <Header isBlog />
        {showResume && (
          <div className="mt-10 w-full flex flex-col items-center">
            <div
              className="w-full bg-white text-slate-900 max-w-4xl p-20 mob:p-5 desktop:p-20 rounded-lg shadow-sm"
            >
              <h1 className="text-3xl font-bold">{name}</h1>
              <h2 className="text-xl mt-5">{resume.tagline}</h2>
              <h3 className="text-sm opacity-0">spacing</h3>
              <a className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center" href="https://black-idalina-62.tiiny.site/">
              <svg className="fill-current w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z" /></svg>
              <span>Download</span>
              </a>
              <h2 className="w-4/5 text-xl mt-5 opacity-50">
                {resume.description}
              </h2>
              <div className="mt-2">
                <Socials />
              </div>
              <div className="mt-5">
                <h2 className="text-2xl font-bold">Experience</h2>

                {resume.experiences.map(
                  ({ id, dates, type, position, bullets }) => (
                    <ProjectResume
                      key={id}
                      dates={dates}
                      type={type}
                      position={position}
                      bullets={bullets}
                    ></ProjectResume>
                  )
                )}
              </div>
              <div className="mt-5">
                <h2 className="text-2xl font-bold">Education</h2>
                {resume.education && (
                  <div className="mt-2">
                    <h3 className="text-lg">{resume.education.universityName}</h3>
                    <h3 className="text-sm opacity-75">
                      {resume.education.universityDate}
                    </h3>
                    <p className="text-sm mt-2 opacity-50">
                      {resume.education.universityPara}
                    </p>
                  </div>
                )}
                {resume.education2 && (
                  <div className="mt-4">
                    <h3 className="text-lg">{resume.education2.universityName}</h3>
                    <h3 className="text-sm opacity-75">
                      {resume.education2.universityDate}
                    </h3>
                    <p className="text-sm mt-2 opacity-50">
                      {resume.education2.universityPara}
                    </p>
                  </div>
                )}
                {resume.education3 && (
                  <div className="mt-4">
                    <h3 className="text-lg">{resume.education3.universityName}</h3>
                    <h3 className="text-sm opacity-75">
                      {resume.education3.universityDate}
                    </h3>
                    <p className="text-sm mt-2 opacity-50">
                      {resume.education3.universityPara}
                    </p>
                  </div>
                )}
              </div>
              <h3 className="text-sm opacity-0">spacing</h3>
              <div className="mt-5">
                <h2 className="text-2xl font-bold">Achievements</h2>
                <div className="mt-2">
                  <h3 className="text-lg font-bold">Team Leader</h3>
                  {Object.values(resume.achievements).map((achievement) => (
                    <p key={achievement} className="text-lg">{achievement}</p>
                  ))}
                </div>
              </div>
              <h3 className="text-sm opacity-0">spacing</h3>
              <div className="mt-5">
                <h2 className="text-2xl font-bold">Skills</h2>
                <div className="flex mob:flex-col desktop:flex-row justify-between">
                  {resume.languages && (
                    <div className="mt-2 mob:mt-5">
                      <h3 className="text-lg">Languages</h3>
                      <ul className="list-disc">
                        {resume.languages.map((language, index) => (
                          <li key={index} className="ml-5 py-2">
                            {language}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resume.frameworks && (
                    <div className="mt-2 mob:mt-5">
                      <h3 className="text-lg">Frameworks</h3>
                      <ul className="list-disc">
                        {resume.frameworks.map((framework, index) => (
                          <li key={index} className="ml-5 py-2">
                            {framework}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resume.others && (
                    <div className="mt-2 mob:mt-5">
                      <h3 className="text-lg">Others</h3>
                      <ul className="list-disc">
                        {resume.others.map((other, index) => (
                          <li key={index} className="ml-5 py-2">
                            {other}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Resume;
