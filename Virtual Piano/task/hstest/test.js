const puppeteer = require('puppeteer');
const path = require('path');
// '..' since we're in the hstest/ subdirectory; learner is supposed to have src/index.html
const pagePath = 'file://' + path.resolve(__dirname, '../src/index.html');

const hs = require('hs-test-web');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function stageTest() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args:['--start-maximized']
    });

    const page = await browser.newPage();
    await page.goto(pagePath);

    page.on('console', msg => {
        console.log(msg.text());
    });

    await sleep(1000);

    await page.evaluate(() => {
        this.realLog = console.log;
        this.userPrinted = [];
        console.log = x => {
            this.userPrinted.push(x);
            this.realLog(x);
        }
    });

    let result = await hs.testPage(page,
        // Test #1 - check all keys are pressed
        // TODO FIXED 09.10.2020
        () => {
            let keys = ['a', 's', 'd', 'f', 'g', 'h', 'j'];

            for (let key of keys) {
                this.realLog("Before: " + JSON.stringify(this.userPrinted));
                hs.press(key);
                this.realLog("After: " + JSON.stringify(this.userPrinted));

                if (this.userPrinted.length !== 1) {
                    return hs.wrong(
                        `When the user presses a key, you should log a single message, ` +
                        `found ${this.userPrinted.length} messages`
                    )
                }

                let elem = this.userPrinted.pop();
                if (!elem.toString().toLowerCase().includes(`'${key}'`)) {
                    return hs.wrong(
                        `When the user pressed a key "${key}", ` +
                        `The output message must include '${key}'\n` +
                        `You printed:\n`+
                        `"${elem}"`
                    );
                }
            }

            return hs.correct()
        },
        // Test #2 - check div element with class container + 7 elements inside
        () => {
            let containerElements = document.getElementsByClassName('container');
            if (containerElements.length === 0) {
                return hs.wrong(`Cannot find element with class 'container'`);
            } else if (containerElements.length > 1) {
                return hs.wrong(`Found ${containerElements.length} elements with class 'container'` +
                    `, the page should contain just a single such element.`);
            }

            let container = containerElements[0];
            this.div = container;

            let contName = container.nodeName.toLowerCase();
            if (contName !== 'div') {
                return hs.wrong(`Cannot find 'div' element with class 'container'.`);
            }

            let containerNodes = Array.from(container.childNodes);
            this.innerDivElements = containerNodes.filter(
                e => e.nodeType === Node.ELEMENT_NODE);

            let len = this.innerDivElements.length;

            return len === 7 ?
                hs.correct() :
                hs.wrong(`Div with class 'container' should contain 7 elements, found: ${len}`)
        },

        // Test #3 - check if all 7 elements are <kbd> elements
        () => {
            let i = 0;
            for (let elem of this.innerDivElements) {
                i++;
                elem = elem.nodeName.toLowerCase();
                if (elem !== 'kbd') {
                    return hs.wrong(`Element #${i} is not <kbd> element, it's <${elem}>`);
                }
            }
            return hs.correct();
        },

        // Test #4 - check if all keys are presented
        () => {
            let expectedKeySet = new Set();

            expectedKeySet.add('A');
            expectedKeySet.add('S');
            expectedKeySet.add('D');
            expectedKeySet.add('F');
            expectedKeySet.add('G');
            expectedKeySet.add('H');
            expectedKeySet.add('J');

            let actualKeySet = new Set();

            let buttons = document.querySelectorAll('kbd');

            for (let button of buttons) {
                actualKeySet.add(button.textContent)
            }

            setsEquals = actualKeySet.size === expectedKeySet.size
                && [...actualKeySet].every(value => expectedKeySet.has(value));

            if (!setsEquals) {
                return hs.wrong(`The names of your keys are incorrect. It must be: A, S, D, F, G, H, J`);
            }

            return hs.correct();
        },

        // Test #5 - check if all 7 elements contain a single letter
        () => {
            let i = 0;
            for (let elem of this.innerDivElements) {
                i++;
                elem = elem.innerHTML;
                if (elem.length === 0) {
                    return hs.wrong(`Element #${i} is empty, but should contain a single letter.`);
                } else if (elem.length > 1) {
                    return hs.wrong(`Element #${i} contains ${elem.length} symbols, ` +
                        `but should contain a single letter. The text inside element is:\n"${elem}"`);
                }
            }
            return hs.correct();
        },

        // Test 6 - Test if all 7 elements have the same top y-coordinate
        // (located on a single horizontal line)
        () => {
            let referenceTop = this.innerDivElements[0].getBoundingClientRect().top;
            let i = 0;
            for (let elem of this.innerDivElements) {
                i++;
                let currTop = elem.getBoundingClientRect().top;
                if (currTop !== referenceTop) {
                    return hs.wrong(`Looks like element #1 and element #${i} ` +
                        `don't have the same top y coordinate. ` +
                        `All 7 elements should be located on a single horizontal line.`)
                }
            }
            return hs.correct();
        },

        // Test 7 - Test if all 7 elements are located in the middle
        () => {
            let width = window.innerWidth;
            let height = window.innerHeight;

            let mostLeftPx = this.innerDivElements[0].getBoundingClientRect().left;
            let mostRightPx = this.innerDivElements[6].getBoundingClientRect().right;

            let freeSpaceOnLeft = mostLeftPx;
            let freeSpaceOnRight = width - mostRightPx;
            let freeSpaceOnTop = this.innerDivElements[0].getBoundingClientRect().top;
            let freeSpaceOnBottom = this.innerDivElements[0].getBoundingClientRect().bottom;

            if (freeSpaceOnLeft < width / 10) {
                return hs.wrong("There should be at least 10% " +
                    "free space to the left of the piano. Are you sure you positioned the piano in the center?")
            }

            if (freeSpaceOnRight < width / 10) {
                return hs.wrong("There should be at least 10% " +
                    "free space to the right of the piano. Are you sure you positioned the piano in the center?")
            }

            if (freeSpaceOnTop < height / 10) {
                return hs.wrong("There should be at least 10% " +
                    "free space above the piano. Are you sure you positioned the piano in the center?")
            }

            if (freeSpaceOnBottom < height / 10) {
                return hs.wrong("There should be at least 10% " +
                    "free space below the piano. Are you sure you positioned the piano in the center?")
            }
            return hs.correct();
        },

        // Test 8 - Test if all elements have border
        () => {
            let i = 0;
            for (let elem of this.innerDivElements) {
                i++;
                let currBorder = window.getComputedStyle(elem).border;
                if (currBorder.includes('0px')) {
                    return hs.wrong(`Looks like piano's element #${i} ` +
                        `has no border. It should have a border.`);
                }
            }
            return hs.correct()
        },

        // Test 9 - Test if all element's background color is white and
        // body's background in not white
        () => {
            function getRealColor(elem) {
                while (elem) {
                    let color = window.getComputedStyle(elem).backgroundColor;
                    if (color !== "rgba(0, 0, 0, 0)") {
                        let match = color.match(/^rgba?\((\d+), (\d+), (\d+)(, \d+)?\)$/i);
                        return {
                            red: Number(match[1]),
                            green: Number(match[2]),
                            blue: Number(match[3]),
                            hex: Number(match[1]) * 65536 + Number(match[2]) * 256 + Number(match[3])
                        };
                    }
                    elem = elem.parentElement;
                }
                return null;
            }

            console.log(document.body)
            let bodyBack = getRealColor(document.body);
            if (bodyBack === null) {
                return hs.wrong("Looks like body's background color is not set. " +
                    "It should be some non-white color.")
            }

            if (bodyBack.hex === 0xFFFFFF) {
                return hs.wrong("Looks like body's background color is white. " +
                    "It should be some non-white color.")
            }

            let i = 0;
            for (let elem of this.innerDivElements) {
                i++;
                let currColor = getRealColor(elem);
                if (currColor.hex !== 0xFFFFFF) {
                    return hs.wrong(`Looks like piano's element #${i} ` +
                        `have non-white background color. It should be colored white.`);
                }
            }
            return hs.correct()
        },

        // Test 10 - Test width, height
        () => {
            let i = 0;
            for (let elem of this.innerDivElements) {
                i++;
                let currDisplay = window.getComputedStyle(elem).display;

                let currWidth = window.getComputedStyle(elem).width;
                if (currWidth === 'auto') {
                    return hs.wrong(`Looks like piano's element #${i} ` +
                        `has width style = 'auto'. It should have some numeric value.`);
                }

                let currHeight = window.getComputedStyle(elem).height;
                if (currHeight === 'auto') {
                    return hs.wrong(`Looks like piano's element #${i} ` +
                        `has height style = 'auto'. It should have some numeric value.`);
                }
            }
            return hs.correct()
        },

        // Test 11 - Checking key distances between keys
        () => {
            let buttons = document.querySelectorAll('kbd');

            let buttonA = null;
            let buttonS = null;

            for (let button of buttons) {
                let buttonText = button.textContent || button.innerText;
                if (buttonText.toLowerCase() === 'a') {
                    buttonA = button
                }

                if (buttonText.toLowerCase() === 's') {
                    buttonS = button
                }
            }

            let coordinateA = buttonA.getBoundingClientRect().right;
            let coordinateS = buttonS.getBoundingClientRect().left;

            let distanceAS = Math.abs(coordinateA - coordinateS);

            if (distanceAS > 5) {
                console.log(distanceAS);
                return hs.wrong(`Make sure there's no extra distance between your white keys. Also, check that the white keys do not overlap.`);
            }

            return hs.correct()
        }
    );

    await browser.close();
    return result;
}


jest.setTimeout(30000);
test("Test stage", async () => {
        let result = await stageTest();
        if (result['type'] === 'wrong') {
            fail(result['message']);
        }
    }
);