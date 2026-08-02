const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const state = {
  bankroll: 1000,
  bet: 25,
  shoe: [],
  dealerCards: [],
  playerHands: [],
  activeHandIndex: 0,
  roundActive: false,
  dealerTurn: false,
  insuranceOffered: false,
  message: "Place a bet and deal a fresh hand.",
  dealerRevealed: false,
  dealerRevealPending: false,
  dealerRevealIndex: -1,
  dealerRevealTimer: null,
  dealerRevealDelay: 350,
  maxHands: 4,
  minBet: 1
};

const elements = {
  bankroll: document.getElementById("bankroll"),
  bet: document.getElementById("bet"),
  betInput: document.getElementById("bet-input"),
  maxBetBtn: document.getElementById("max-bet-btn"),
  clearBetBtn: document.getElementById("clear-bet-btn"),
  dealerCards: document.getElementById("dealer-cards"),
  dealerTotal: document.getElementById("dealer-total"),
  playerHands: document.getElementById("player-hands"),
  message: document.getElementById("message"),
  dealBtn: document.getElementById("deal-btn"),
  resetBtn: document.getElementById("reset-btn"),
  hitBtn: document.getElementById("hit-btn"),
  standBtn: document.getElementById("stand-btn"),
  doubleBtn: document.getElementById("double-btn"),
  splitBtn: document.getElementById("split-btn"),
  insuranceModal: document.getElementById("insurance-modal"),
  insuranceModalMessage: document.getElementById("insurance-modal-message"),
  insuranceBtn: document.getElementById("insurance-btn"),
  declineInsuranceBtn: document.getElementById("decline-insurance-btn")
};

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value) {
  return roundMoney(value).toFixed(2);
}

function buildShoe() {
  const shoe = [];
  for (let deck = 0; deck < 6; deck += 1) {
    for (const suit of suits) {
      for (const rank of ranks) {
        shoe.push({ suit, rank });
      }
    }
  }
  return shuffle(shoe);
}

function shuffle(cards) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function drawCard() {
  if (state.shoe.length < 20) {
    state.shoe = buildShoe();
  }
  return state.shoe.pop();
}

function cardValue(rank) {
  if (rank === "A") return 11;
  if (["J", "Q", "K"].includes(rank)) return 10;
  return Number(rank);
}

function getHandValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === "A") aces += 1;
  }
  while (aces > 0 && total > 21) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isSoft(cards) {
  if (!cards.some((card) => card.rank === "A")) {
    return false;
  }
  const lowValue = cards.reduce((sum, card) => sum + (card.rank === "A" ? 1 : cardValue(card.rank)), 0);
  return lowValue + 10 <= 21;
}

function isBlackjack(cards) {
  return cards.length === 2 && getHandValue(cards) === 21;
}

function isPair(cards) {
  return cards.length === 2 && cards[0].rank === cards[1].rank;
}

function resetRound() {
  if (state.dealerRevealTimer) {
    window.clearTimeout(state.dealerRevealTimer);
    state.dealerRevealTimer = null;
  }
  state.dealerCards = [];
  state.playerHands = [];
  state.activeHandIndex = 0;
  state.roundActive = false;
  state.dealerTurn = false;
  state.insuranceOffered = false;
  state.dealerRevealed = false;
  state.dealerRevealPending = false;
  state.dealerRevealIndex = -1;
  state.message = "Place a bet and deal a fresh hand.";
}

function resetBankroll() {
  state.bankroll = 1000;
  resetRound();
  render();
}

function updateBet() {
  // Don't rewrite the input while the player is actively typing/clearing it —
  // that's what made it impossible to clear the box before. Just reflect a
  // live preview in the "Current bet" stat; real validation happens on commit.
  const raw = elements.betInput.value;
  const value = Number(raw);
  if (raw.trim() !== "" && Number.isFinite(value)) {
    elements.bet.textContent = `$${formatMoney(value)}`;
  }
}

function commitBet() {
  const raw = Number(elements.betInput.value);
  let value = Number.isFinite(raw) ? roundMoney(raw) : state.minBet;
  value = Math.max(state.minBet, value);
  if (state.bankroll > 0) {
    value = Math.min(value, state.bankroll);
  }
  state.bet = value;
  elements.betInput.value = String(state.bet);
  render();
}

function handleMaxBet() {
  elements.betInput.value = String(roundMoney(state.bankroll));
  commitBet();
}

function handleClearBet() {
  elements.betInput.value = "";
  elements.betInput.focus();
}

function startRound() {
  commitBet();
  const bet = roundMoney(Math.min(state.bet, state.bankroll));
  if (bet <= 0) {
    state.message = "You need a positive bankroll to play.";
    render();
    return;
  }

  resetRound();
  state.bankroll = roundMoney(state.bankroll - bet);
  state.playerHands.push({
    cards: [drawCard(), drawCard()],
    bet,
    baseBet: bet,
    status: "playing",
    doubled: false,
    split: false,
    insuranceBet: 0
  });
  state.dealerCards = [drawCard(), drawCard()];
  state.roundActive = true;

  const playerBlackjack = isBlackjack(state.playerHands[0].cards);
  const dealerBlackjack = isBlackjack(state.dealerCards);

  if (playerBlackjack && dealerBlackjack) {
    state.bankroll = roundMoney(state.bankroll + state.playerHands[0].bet);
    state.message = "Push — both hands have blackjack.";
    state.roundActive = false;
    state.dealerRevealed = true;
    render();
    return;
  }

  if (playerBlackjack) {
    state.bankroll = roundMoney(state.bankroll + state.playerHands[0].bet * 2.5);
    state.message = "Blackjack! You win 3:2.";
    state.roundActive = false;
    state.dealerRevealed = true;
    render();
    return;
  }

  if (state.dealerCards[0].rank === "A" && !dealerBlackjack) {
    state.insuranceOffered = true;
    state.message = "Insurance is available. Take it or decline.";
    render();
    return;
  }

  if (dealerBlackjack) {
    state.message = "Dealer has blackjack. You lose the hand.";
    state.roundActive = false;
    state.dealerRevealed = true;
    render();
    return;
  }

  state.dealerRevealed = false;
  state.message = "Choose to hit, stand, double down or split.";
  render();
}

function handleInsurance(accepted) {
  if (!state.insuranceOffered) return;

  const hand = state.playerHands[0];
  const insuranceBet = roundMoney(hand.baseBet / 2);
  if (accepted) {
    if (state.bankroll < insuranceBet) {
      state.message = "Not enough bankroll for insurance.";
      render();
      return;
    }
    state.bankroll = roundMoney(state.bankroll - insuranceBet);
    hand.insuranceBet = insuranceBet;
  }

  state.insuranceOffered = false;
  const dealerBlackjack = isBlackjack(state.dealerCards);
  if (dealerBlackjack) {
    if (hand.insuranceBet > 0) {
      state.bankroll = roundMoney(state.bankroll + hand.insuranceBet * 2);
    }
    state.message = hand.insuranceBet > 0 ? "Dealer has blackjack. Insurance pays 2:1." : "Dealer has blackjack. You lose the hand.";
    state.roundActive = false;
    state.dealerRevealed = true;
    render();
    return;
  }

  state.dealerRevealed = false;
  state.message = accepted ? "Insurance purchased. Dealer does not have blackjack." : "No insurance. Dealer does not have blackjack.";
  render();
}

function handleHit() {
  if (!state.roundActive || state.dealerTurn || state.insuranceOffered) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || hand.status !== "playing") return;

  hand.cards.push(drawCard());
  const total = getHandValue(hand.cards);
  if (total > 21) {
    hand.status = "bust";
    state.message = "Bust!";
    advanceHand();
    return;
  }

  if (total === 21) {
    hand.status = "stand";
    state.message = "21! Standing on this hand.";
    advanceHand();
    return;
  }

  state.message = `Hit. Hand value is ${total}.`;
  render();
}

function handleStand() {
  if (!state.roundActive || state.dealerTurn || state.insuranceOffered) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || hand.status !== "playing") return;

  hand.status = "stand";
  state.message = "Stand. Moving to the next hand.";
  advanceHand();
}

function handleDouble() {
  if (!state.roundActive || state.dealerTurn || state.insuranceOffered) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || hand.status !== "playing" || hand.doubled || hand.cards.length !== 2) return;
  if (state.bankroll < hand.baseBet) {
    state.message = "Not enough bankroll to double down.";
    render();
    return;
  }

  state.bankroll = roundMoney(state.bankroll - hand.baseBet);
  hand.bet = roundMoney(hand.bet + hand.baseBet);
  hand.doubled = true;
  hand.cards.push(drawCard());
  const total = getHandValue(hand.cards);
  hand.status = total > 21 ? "bust" : "stand";
  state.message = total > 21 ? "Double down busts the hand." : "Double down complete.";
  advanceHand();
}

function handleSplit() {
  if (!state.roundActive || state.dealerTurn || state.insuranceOffered) return;
  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || hand.status !== "playing" || !isPair(hand.cards) || hand.split) return;
  if (state.playerHands.length >= state.maxHands) {
    state.message = `You can split up to ${state.maxHands - 1} times.`;
    render();
    return;
  }
  if (state.bankroll < hand.baseBet) {
    state.message = "Not enough bankroll to split.";
    render();
    return;
  }

  state.bankroll = roundMoney(state.bankroll - hand.baseBet);
  const [firstCard, secondCard] = hand.cards;
  const isAcesSplit = firstCard.rank === "A";
  const leftHand = {
    cards: [firstCard],
    bet: hand.baseBet,
    baseBet: hand.baseBet,
    status: "playing",
    doubled: false,
    split: true,
    insuranceBet: 0
  };
  const rightHand = {
    cards: [secondCard],
    bet: hand.baseBet,
    baseBet: hand.baseBet,
    status: "playing",
    doubled: false,
    split: true,
    insuranceBet: 0
  };

  state.playerHands.splice(state.activeHandIndex, 1, leftHand, rightHand);
  leftHand.cards.push(drawCard());
  rightHand.cards.push(drawCard());
  state.activeHandIndex = 0;

  if (isAcesSplit) {
    leftHand.status = "stand";
    rightHand.status = "stand";
    state.message = "Split aces — one card each, no further hitting.";
    advanceHand();
    return;
  }

  state.message = "Split complete. Play each hand.";
  render();
}

function advanceHand() {
  let nextIndex = state.activeHandIndex + 1;
  while (nextIndex < state.playerHands.length) {
    if (state.playerHands[nextIndex].status === "playing") {
      state.activeHandIndex = nextIndex;
      state.message = `Playing hand ${nextIndex + 1}.`;
      render();
      return;
    }
    nextIndex += 1;
  }

  const anyLiveHand = state.playerHands.some((hand) => hand.status !== "bust");
  if (!anyLiveHand) {
    settleAllBusted();
    return;
  }

  resolveDealerTurn();
}

function settleAllBusted() {
  if (state.dealerRevealTimer) {
    window.clearTimeout(state.dealerRevealTimer);
    state.dealerRevealTimer = null;
  }
  state.message = state.playerHands.length > 1 ? "All hands bust. Round over." : "Bust. Round over.";
  state.roundActive = false;
  state.dealerTurn = false;
  state.dealerRevealed = true;
  state.dealerRevealPending = false;
  state.dealerRevealIndex = -1;
  render();
}

function resolveDealerTurn() {
  state.dealerTurn = true;
  state.message = "Dealer is playing.";
  render();
  revealDealerCard(1, continueDealerTurn);
}

function revealDealerCard(index, callback) {
  if (state.dealerRevealTimer) {
    window.clearTimeout(state.dealerRevealTimer);
  }

  state.dealerRevealPending = true;
  state.dealerRevealIndex = index;
  render();

  state.dealerRevealTimer = window.setTimeout(() => {
    state.dealerRevealTimer = null;
    state.dealerRevealPending = false;
    state.dealerRevealIndex = -1;
    state.dealerRevealed = true;
    render();
    if (callback) {
      callback();
    }
  }, state.dealerRevealDelay);
}

function continueDealerTurn() {
  const dealerTotal = getHandValue(state.dealerCards);

  if (dealerTotal < 17) {
    state.dealerCards.push(drawCard());
    state.message = "Dealer hits.";
    revealDealerCard(state.dealerCards.length - 1, continueDealerTurn);
    return;
  }

  if (dealerTotal === 17 && isSoft(state.dealerCards)) {
    state.message = "Dealer stands on soft 17.";
    render();
    state.dealerRevealTimer = window.setTimeout(() => {
      state.dealerRevealTimer = null;
      settleRound();
    }, state.dealerRevealDelay);
    return;
  }

  state.message = dealerTotal > 21 ? "Dealer busts." : "Dealer stands.";
  render();
  state.dealerRevealTimer = window.setTimeout(() => {
    state.dealerRevealTimer = null;
    settleRound();
  }, state.dealerRevealDelay);
}

function settleRound() {
  if (state.dealerRevealTimer) {
    window.clearTimeout(state.dealerRevealTimer);
    state.dealerRevealTimer = null;
  }

  const dealerTotal = getHandValue(state.dealerCards);
  if (dealerTotal > 21) {
    for (const hand of state.playerHands) {
      if (hand.status !== "bust") {
        state.bankroll = roundMoney(state.bankroll + hand.bet * 2);
      }
    }
    state.message = `Dealer busts. All non-busted hands win 1:1.`;
  } else {
    for (const hand of state.playerHands) {
      if (hand.status === "bust") {
        continue;
      }

      const handValue = getHandValue(hand.cards);
      if (handValue > dealerTotal) {
        state.bankroll = roundMoney(state.bankroll + hand.bet * 2);
      } else if (handValue < dealerTotal) {
        // Loss; no payout.
      } else {
        state.bankroll = roundMoney(state.bankroll + hand.bet);
      }
    }
    state.message = `Dealer stands on ${dealerTotal}. Round settled.`;
  }

  state.roundActive = false;
  state.dealerTurn = false;
  state.dealerRevealed = true;
  state.dealerRevealPending = false;
  state.dealerRevealIndex = -1;
  render();
}

function render() {
  elements.bankroll.textContent = `$${formatMoney(state.bankroll)}`;
  elements.bet.textContent = `$${formatMoney(state.bet)}`;
  if (document.activeElement !== elements.betInput) {
    elements.betInput.value = String(state.bet);
  }
  renderDealer();
  renderPlayerHands();
  renderControls();
  renderInsuranceModal();
  elements.message.textContent = state.message;
}

function renderDealer() {
  const dealerCardsMarkup = state.dealerCards
    .map((card, index) => {
      const shouldAnimate = state.dealerRevealPending && state.dealerRevealIndex === index;
      if (!state.dealerRevealed && index === 1 && !shouldAnimate) {
        return '<div class="card back">?</div>';
      }
      const suitClass = ["♥", "♦"].includes(card.suit) ? "red" : "";
      const animationClass = shouldAnimate ? "reveal-card" : "";
      return `<div class="card ${suitClass} ${animationClass}">${card.rank}${card.suit}</div>`;
    })
    .join("");

  elements.dealerCards.innerHTML = dealerCardsMarkup;
  const visibleCards = state.dealerRevealed ? state.dealerCards : state.dealerCards.slice(0, 1);
  const dealerTotalText = visibleCards.length > 0 ? `Total: ${getHandValue(visibleCards)}` : "Total: —";
  elements.dealerTotal.textContent = dealerTotalText;
}

function renderPlayerHands() {
  if (state.playerHands.length === 0) {
    elements.playerHands.innerHTML = "<p>No active hand.</p>";
    return;
  }

  elements.playerHands.innerHTML = state.playerHands
    .map((hand, index) => {
      const cardsMarkup = hand.cards
        .map((card) => {
          const suitClass = ["♥", "♦"].includes(card.suit) ? "red" : "";
          return `<div class="card ${suitClass}">${card.rank}${card.suit}</div>`;
        })
        .join("");
      const activeClass = index === state.activeHandIndex ? "active" : "";
      const handValue = getHandValue(hand.cards);
      const label = index === 0 ? "Primary" : `Split ${index}`;
      return `
        <article class="hand-card ${activeClass}">
          <div class="hand-topline">
            <span class="hand-label">${label}</span>
            <span class="hand-status">${hand.status}</span>
          </div>
          <div class="card-row">${cardsMarkup}</div>
          <div class="hand-total">
            Total: ${handValue} • Bet: $${formatMoney(hand.bet)} • Insurance: $${formatMoney(hand.insuranceBet)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderControls() {
  const activeHand = state.playerHands[state.activeHandIndex];
  const canSplit = !!activeHand && activeHand.status === "playing" && isPair(activeHand.cards) && !activeHand.split;
  const canDouble = !!activeHand && activeHand.status === "playing" && activeHand.cards.length === 2 && !activeHand.doubled;

  elements.hitBtn.disabled = !state.roundActive || state.dealerTurn || state.insuranceOffered || !activeHand || activeHand.status !== "playing";
  elements.standBtn.disabled = !state.roundActive || state.dealerTurn || state.insuranceOffered || !activeHand || activeHand.status !== "playing";
  elements.doubleBtn.disabled = !state.roundActive || state.dealerTurn || state.insuranceOffered || !canDouble;
  elements.splitBtn.disabled = !state.roundActive || state.dealerTurn || state.insuranceOffered || !canSplit;
  elements.dealBtn.disabled = state.roundActive;
}

function renderInsuranceModal() {
  if (!elements.insuranceModal) {
    return;
  }

  elements.insuranceModal.classList.toggle("hidden", !state.insuranceOffered);
  elements.insuranceModalMessage.textContent = state.insuranceOffered
    ? "The dealer shows an Ace. Insurance costs half your original bet and pays 2:1 if the dealer has blackjack."
    : "";
}

function bindEvents() {
  elements.dealBtn.addEventListener("click", startRound);
  elements.resetBtn.addEventListener("click", resetBankroll);
  elements.hitBtn.addEventListener("click", handleHit);
  elements.standBtn.addEventListener("click", handleStand);
  elements.doubleBtn.addEventListener("click", handleDouble);
  elements.splitBtn.addEventListener("click", handleSplit);
  elements.insuranceBtn.addEventListener("click", () => handleInsurance(true));
  elements.declineInsuranceBtn.addEventListener("click", () => handleInsurance(false));
  elements.betInput.addEventListener("input", updateBet);
  elements.betInput.addEventListener("blur", commitBet);
  elements.maxBetBtn.addEventListener("click", handleMaxBet);
  elements.clearBetBtn.addEventListener("click", handleClearBet);
}

function init() {
  state.shoe = buildShoe();
  bindEvents();
  render();
}

init();
