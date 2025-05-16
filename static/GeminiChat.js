const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resultsContainer = document.getElementById('results-container');
const resultsContent = document.getElementById('results-content');

let conversationHistory = [];

function addUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'user-message');
    messageElement.innerHTML = `<div class="message-content">${message}</div>`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addAIMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'ai-message');
    messageElement.innerHTML = `<div class="message-content">${message}</div>`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function displayResults(results) {
    resultsContainer.classList.remove('hidden');
    resultsContent.innerHTML = '';

    if (results && results.length > 0) {
        const top7Results = results.slice(0, 7);
        top7Results.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.classList.add('result-item');
            let ticketInfo = item.ticketPrice ? `Ticket Price: ${item.ticketPrice}` : 'Free Entry';
            const ratingInfo = item.rating ? `Rating: ${item.rating}/5` : 'Rating not available';

            resultItem.innerHTML = `
                <h3 class="result-name">${item.name}</h3>
                <p class="result-description">${item.description}</p>
                <p class="result-ticket">${ticketInfo}</p>
                <p class="result-rating">${ratingInfo}</p>
            `;
            resultsContent.appendChild(resultItem);
        });
    } else {
        resultsContent.innerHTML = '<p class="no-results">No relevant tourism spots found.</p>';
    }
}

sendButton.addEventListener('click', () => {
    const userQuery = userInput.value.trim();
    if (userQuery) {
        addUserMessage(userQuery);
        userInput.value = '';

        addAIMessage("Finding tourism spots...");

        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userQuery,
                history: conversationHistory,
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                addAIMessage(`Error: ${data.error}`);
            } else {
                const aiResponse = data.response;
                const extractedResults = extractResultsFromText(aiResponse);

                let chatOutput = "Here are some places:<br>";
                let hasValidResults = false;

                extractedResults.slice(0, 7).forEach((item, index) => {
                    if (item.name && item.description) {
                        const formattedName = item.name.replace(/\*/g, '');
                        const formattedDescription = item.description.replace(/\*/g, '');
                        const ticketInfo = item.ticketPrice ? `Ticket Price: ${item.ticketPrice}` : 'Free Entry';
                        const ratingInfo = item.rating ? `Rating: ${item.rating}/5` : 'Rating not available';
                        chatOutput += `${index + 1}. <strong>${formattedName}:</strong> ${formattedDescription} - ${ticketInfo}, ${ratingInfo}<br><br>`;
                        hasValidResults = true;
                    }
                });

                if (hasValidResults) {
                    addAIMessage(chatOutput);
                } else {
                    addAIMessage("No tourism spots found.");
                }

                conversationHistory.push({ role: "user", parts: [userQuery] });
                conversationHistory.push({ role: "model", parts: [aiResponse] });

                displayResults(extractedResults);
            }
        })
        .catch(error => {
            addAIMessage(`Error: ${error.message}`);
            console.error('Error sending message to backend:', error);
        });
    }
});

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendButton.click();
    }
});

function extractResultsFromText(text) {
    const results = [];
    const lines = text.split('\n');
    let currentName = '';
    let currentDescription = '';
    let insideSpot = false;
    let spotNumber = 0;
    let currentTicketPrice = '';
    let currentRating = '';

    for (const line of lines) {
        const spotNumberMatch = line.match(/^\d+\.\s/);

        if (spotNumberMatch) {
            spotNumber = parseInt(spotNumberMatch[0]);
            const parts = line.substring(spotNumberMatch[0].length).split(':');
            if (parts.length === 2) {
                currentName = parts[0].trim().replace(/\*/g, '');
                currentDescription = parts[1].trim().replace(/\*/g, '');
                currentTicketPrice = extractTicketPrice(currentDescription);
                currentRating = extractRating(currentDescription);
                results.push({
                    name: currentName.trim(),
                    description: currentDescription.trim(),
                    number: spotNumber,
                    ticketPrice: currentTicketPrice,
                    rating: currentRating
                });
            }
            insideSpot = false;
        } else if (line.startsWith('* ')) {
            const parts = line.substring(2).split(':');
            if (parts.length === 2) {
                currentName = parts[0].trim().replace(/\*/g, '');
                currentDescription = parts[1].trim().replace(/\*/g, '');
                 currentTicketPrice = extractTicketPrice(currentDescription);
                currentRating = extractRating(currentDescription);
                results.push({
                    name: currentName.trim(),
                    description: currentDescription.trim(),
                    number: spotNumber,
                    ticketPrice: currentTicketPrice,
                    rating: currentRating
                });
            }
            insideSpot = false;
        } else if (insideSpot) {
            if (line.trim() !== "" && !line.includes("Tips for Visiting:") && !line.includes("Other Considerations:")) {
                currentDescription += " " + line.trim();
            }
        }
    }
    return results;
}


function extractTicketPrice(description) {
    const priceKeywords = ["Ticket Price:", "Entry Fee:", "Admission:"];
    for (const keyword of priceKeywords) {
        const index = description.indexOf(keyword);
        if (index !== -1) {
            let priceString = description.substring(index + keyword.length).trim();
             const currencySymbols = ['$', 'US$', '€', '£', '¥', '₩', '₹', 'Rp'];
            let priceValue = '';
            for (const char of priceString)
            {
                if (char >= '0' && char <= '9' || char == '.' || currencySymbols.includes(char))
                {
                    priceValue += char;
                }
                else{
                    break;
                }
            }
            return priceValue.trim() ? priceValue.trim() : null;
        }
    }
    return null;
}

function extractRating(description) {
    const ratingKeywords = ["Rating:", "Rated:"];
    for (const keyword of ratingKeywords) {
        const index = description.indexOf(keyword);
        if (index !== -1) {
            const ratingString = description.substring(index + keyword.length).trim();
            const match = ratingString.match(/(\d+(\.\d)?)\/5/);
            return match ? parseFloat(match[1]) : null;
        }
    }
    return null;
}
