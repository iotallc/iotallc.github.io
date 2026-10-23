/*
  IOTA site configuration. Edit values here; site.js reads this file.

  METRICS: the IOTA RAG numbers are not known yet. Every value left as "X"
  shows on the page with an amber dashed outline so it is easy to spot.
  Replace "X" with the real figure (numbers only, no % or x sign), for example
  computeFactor: "4", speedPercent: "35", savingsPercent: "80".

  Note: with JavaScript turned off, the page shows the fallback text written in
  index.html (also "X"). After you set real numbers, run
  python3 tools/apply-config.py to copy them into the HTML as well.
*/
window.IOTA_CONFIG = {
  metrics: {
    computeFactor: "X",      // "Lowers model compute needs by [X]x"
    speedPercent: "X",       // "Increases speed by [X]% on tested models"
    savingsPercent: "X",     // "Average savings vs general use: [X]%"
    generalModel: "[General frontier model]",      // the large general-use model in the comparison
    localModel: "[Small local model]",             // the small model running with IOTA RAG
    testNote: "[Describe the tasks, hardware, and dates of the tests here.]"
  },
  links: {
    email: "IOTA.LLC.Business.Inquiries@gmail.com",
    mobileBeta: "https://play.google.com/apps/testing/iotaAi.mobile",
    talesBeta: "https://play.google.com/apps/testing/com.iotallc.iotatales",
    // Joseph's LinkedIn profile. Every general LinkedIn link on the site reads this value.
    // The RAG post link in the IOTA RAG section is separate and stays https://lnkd.in/p/gVtDwH8E.
    linkedin: "https://www.linkedin.com/in/josephbryant-pw"
  },
  // Title shown in About. Other options: "Founder and CEO", "Founder and Principal", "Founder and Managing Member".
  founderTitle: "Founder"
};
