// ==UserScript==
// @name         PayCheck for X (Formerly Twitter)
// @description  See (a very VERY rough idea of) how much money a post is worth.
// @version      0.0.5
// @author       yungsamd17 & Theo @t3dotgg
// @namespace    https://github.com/yungsamd17/paycheck-userscript
// @downloadURL  https://github.com/yungsamd17/paycheck-userscript/raw/main/userscript/paycheck-for-twitter.user.js
// @updateURL    https://github.com/yungsamd17/paycheck-userscript/raw/main/userscript/paycheck-for-twitter.user.js
// @icon         https://raw.githubusercontent.com/yungsamd17/paycheck-userscript/main/assets/paycheck-for-twitter.png
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @match        https://tweetdeck.twitter.com/*
// @match        https://x.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

function convertToRawCount(internationalInputString) {
  const numberPattern = /([\d,.]+)([kmb]*)/i;
  const matches = internationalInputString.match(numberPattern);

  if (!matches) {
    return NaN; // Return NaN if the input doesn't match the expected pattern
  }

  const numericPart = matches[1];
  const multiplier = matches[2].toLowerCase();

  let numericValue;

  const lastChars = [
    numericPart.slice(-1),
    numericPart.slice(-2, -1),
    numericPart.slice(-3, -2),
  ];

  // Check if second or third to last character are , or . to handle international numbers
  if (lastChars.includes(".") || lastChars.includes(",")) {
    const parts = numericPart.replace(",", ".").split(".");
    const integerPart = parts[0].replace(/[,]/g, "");
    const decimalPart = parts[1] ? parts[1] : "0";
    numericValue = parseFloat(integerPart + "." + decimalPart);
  } else {
    numericValue = parseFloat(numericPart.replaceAll(",", ""));
  }

  let factor = 1;

  switch (multiplier) {
    case "k":
      factor = 1000;
      break;
    case "m":
      factor = 1000000;
      break;
    case "b":
      factor = 1000000000;
      break;
  }

  return Math.round(numericValue * factor);
}

function convertToDollars(number) {
  const rawCount = convertToRawCount(number);

  const processed = rawCount * 0.000026;
  if (processed < 0.1) return processed.toFixed(5);
  return processed.toFixed(2);
}

const globalSelectors = {};
globalSelectors.postCounts = `[role="group"][id*="id__"]:only-child`;
globalSelectors.articleDate = `[role="article"][aria-labelledby*="id__"][tabindex="-1"] time`;
globalSelectors.analyticsLink = " :not(.dollarBox)>a[href*='/analytics']";
globalSelectors.viewCount =
  globalSelectors.postCounts + globalSelectors.analyticsLink;

const innerSelectors = {};
innerSelectors.dollarSpot = "div div:first-child";
innerSelectors.viewSVG = "div div:first-child svg";
innerSelectors.viewAmount = "div div:last-child span span span";
innerSelectors.articleViewAmount = "span div:first-child span span span";

function doWork() {
  const viewCounts = Array.from(
    document.querySelectorAll(globalSelectors.viewCount)
  );

  const articleViewDateSections = document.querySelectorAll(globalSelectors.articleDate);

  if (articleViewDateSections.length) {
    // the rootDateViewsSection will always be the parent->parent->parent of the last element of the articleDate querySelectorAll result
    let rootDateViewsSection = articleViewDateSections[articleViewDateSections.length - 1].parentElement.parentElement.parentElement;

    // if there is one child, that means it's an old tweet with no viewcount
    // if there are more than 4, we already added the paycheck value
    if (rootDateViewsSection?.children?.length !== 1 && rootDateViewsSection?.children.length < 4) {
      // clone 2nd and 3rd child of rootDateViewsSection
      const clonedDateViewSeparator =
        rootDateViewsSection?.children[1].cloneNode(true);
      const clonedDateView = rootDateViewsSection?.children[2].cloneNode(true);

      // insert clonedDateViews and clonedDateViewsTwo after the 3rd child we just cloned
      rootDateViewsSection?.insertBefore(
        clonedDateViewSeparator,
        rootDateViewsSection?.children[2].nextSibling
      );
      rootDateViewsSection?.insertBefore(
        clonedDateView,
        rootDateViewsSection?.children[3].nextSibling
      );

      // get view count value from 'clonedDateViewsTwo'
      const viewCountValue = clonedDateView?.querySelector(
        innerSelectors.articleViewAmount
      )?.textContent;
      const dollarAmount = convertToDollars(viewCountValue);

      // replace textContent in cloned clonedDateViews (now 4th child) with converted view count value
      clonedDateView.querySelector(
        innerSelectors.articleViewAmount
      ).textContent = "$" + dollarAmount;

      // remove 'views' label
      clonedDateView.querySelector(`span`).children[1].remove();
    }
  }

  for (const view of viewCounts) {
    // only add the dollar box once
    if (!view.classList.contains("replaced")) {
      // make sure we don't touch this one again
      view.classList.add("replaced");

      // get parent and clone to make dollarBox
      const parent = view.parentElement;
      const dollarBox = parent.cloneNode(true);
      dollarBox.classList.add("dollarBox");

      // insert dollarBox after view count
      parent.parentElement.insertBefore(dollarBox, parent.nextSibling);

      // remove view count icon
      const oldIcon = dollarBox.querySelector(innerSelectors.viewSVG);
      oldIcon?.remove();

      // swap the svg for a dollar sign
      const dollarSpot = dollarBox.querySelector(innerSelectors.dollarSpot)
        ?.firstChild?.firstChild;
      dollarSpot.textContent = "$";

      // magic alignment value
      dollarSpot.style.marginTop = "-0.6rem";
    }

    // get the number of views and calculate & set the dollar amount
    const dollarBox = view.parentElement.nextSibling.firstChild;
    const viewCount = view.querySelector(
      innerSelectors.viewAmount
    )?.textContent;
    if (viewCount == undefined) continue;
    const dollarAmountArea = dollarBox.querySelector(innerSelectors.viewAmount);
    dollarAmountArea.textContent = convertToDollars(viewCount);
  }
}

function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function () {
    const context = this;
    const args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function () {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

// Function to start MutationObserver
const observe = () => {
  const runDocumentMutations = throttle(() => {
    requestAnimationFrame(doWork);
  }, 1000);

  const observer = new MutationObserver((mutationsList) => {
    if (!mutationsList.length) return;
    runDocumentMutations();
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
};

observe();
