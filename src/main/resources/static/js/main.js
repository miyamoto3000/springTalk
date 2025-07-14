'use strict';

const usernamePage = document.querySelector('#username-page');
const chatPage = document.querySelector('#chat-page');
const usernameForm = document.querySelector('#usernameForm');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const connectingElement = document.querySelector('.connecting');
const chatArea = document.querySelector('#chat-messages');
const logout = document.querySelector('#logout');

let stompClient = null;
let nickname = null;
let fullname = null;
let selectedUserId = null;

function connect(event) {
    nickname = document.querySelector('#nickname').value.trim();
    fullname = document.querySelector('#fullname').value.trim();

    if (nickname && fullname) {
        gsap.to(usernamePage, {
            opacity: 0,
            y: -50,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
                usernamePage.classList.add('hidden');
                chatPage.classList.remove('hidden');
                gsap.fromTo(chatPage,
                    { opacity: 0, scale: 0.95 },
                    { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
                );
            }
        });

        const socket = new SockJS('http://localhost:8088/ws');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}

function onConnected() {
    stompClient.subscribe(`/user/${nickname}/queue/messages`, onMessageReceived);
    stompClient.subscribe(`/user/public`, onMessageReceived);

    stompClient.send("/app/user.addUser", {}, JSON.stringify({ nickName: nickname, fullName: fullname, status: 'ONLINE' }));
    document.querySelector('#connected-user-fullname').textContent = fullname;
    findAndDisplayConnectedUsers();
}

async function findAndDisplayConnectedUsers() {
    try {
        const connectedUsersResponse = await fetch('http://localhost:8088/users');
        let connectedUsers = await connectedUsersResponse.json();
        connectedUsers = connectedUsers.filter(user => user.nickName !== nickname);
        const connectedUsersList = document.getElementById('connectedUsers');
        connectedUsersList.innerHTML = '';

        connectedUsers.forEach((user, index) => {
            appendUserElement(user, connectedUsersList);
            if (index < connectedUsers.length - 1) {
                const separator = document.createElement('li');
                separator.className = 'h-px bg-[#2a3942] my-2';
                connectedUsersList.appendChild(separator);
            }
        });

        gsap.from('.user-item', {
            opacity: 0,
            x: -20,
            stagger: 0.1,
            duration: 0.4,
            ease: 'power2.out'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

function appendUserElement(user, connectedUsersList) {
    const listItem = document.createElement('li');
    listItem.className = 'user-item flex items-center p-3 rounded-lg cursor-pointer hover:bg-[#2a3942]';
    listItem.id = user.nickName;

    const userImage = document.createElement('img');
    userImage.src = 'img/user_icon.png';
    userImage.alt = user.fullName;
    userImage.className = 'w-10 h-10 rounded-full mr-3';

    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = user.fullName;
    usernameSpan.className = 'text-gray-300 font-medium flex-1';

    const receivedMsgs = document.createElement('span');
    receivedMsgs.textContent = '0';
    receivedMsgs.className = 'nbr-msg hidden ml-auto bg-[#00a884] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center';

    listItem.appendChild(userImage);
    listItem.appendChild(usernameSpan);
    listItem.appendChild(receivedMsgs);

    listItem.addEventListener('click', userItemClick);
    connectedUsersList.appendChild(listItem);
}

function userItemClick(event) {
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('bg-[#2a3942]'));
    messageForm.classList.remove('hidden');

    const clickedUser = event.currentTarget;
    clickedUser.classList.add('bg-[#2a3942]');
    selectedUserId = clickedUser.getAttribute('id');
    fetchAndDisplayUserChat();

    const nbrMsg = clickedUser.querySelector('.nbr-msg');
    nbrMsg.classList.add('hidden');
    nbrMsg.textContent = '0';

    gsap.from(clickedUser, {
        scale: 0.97,
        duration: 0.2,
        ease: 'power2.out'
    });
}

function displayMessage(senderId, content) {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message flex ${senderId === nickname ? 'justify-end' : 'justify-start'}`;

    const message = document.createElement('p');
    message.textContent = content;
    message.className = `p-3 rounded-2xl ${senderId === nickname ? 'bg-[#00a884] text-white tail-right' : 'bg-[#2a3942] text-gray-300 tail-left'}`;

    messageContainer.appendChild(message);
    chatArea.appendChild(messageContainer);

    gsap.from(messageContainer, {
        opacity: 0,
        y: 20,
        duration: 0.4,
        ease: 'power2.out'
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}

async function fetchAndDisplayUserChat() {
    try {
        const userChatResponse = await fetch(`http://localhost:8088/messages/${nickname}/${selectedUserId}`);
        const userChat = await userChatResponse.json();
        chatArea.innerHTML = '';
        userChat.forEach(chat => {
            displayMessage(chat.senderId, chat.content);
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    } catch (error) {
        console.error('Error fetching chat:', error);
    }
}

function onError() {
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh to try again!';
    connectingElement.classList.remove('hidden');
}

function sendMessage(event) {
    const messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        const chatMessage = {
            senderId: nickname,
            recipientId: selectedUserId,
            content: messageContent,
            timestamp: new Date()
        };
        stompClient.send("/app/chat", {}, JSON.stringify(chatMessage));
        displayMessage(nickname, messageContent);
        messageInput.value = '';
    }
    chatArea.scrollTop = chatArea.scrollHeight;
    event.preventDefault();
}

async function onMessageReceived(payload) {
    await findAndDisplayConnectedUsers();
    const message = JSON.parse(payload.body);
    if (selectedUserId && selectedUserId === message.senderId) {
        displayMessage(message.senderId, message.content);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    if (selectedUserId) {
        document.querySelector(`#${selectedUserId}`).classList.add('bg-[#2a3942]');
    } else {
        messageForm.classList.add('hidden');
    }

    const notifiedUser = document.querySelector(`#${message.senderId}`);
    if (notifiedUser && !notifiedUser.classList.contains('bg-[#2a3942]')) {
        const nbrMsg = notifiedUser.querySelector('.nbr-msg');
        nbrMsg.classList.remove('hidden');
        nbrMsg.textContent = '';
    }
}

function onLogout() {
    if (stompClient) {
        stompClient.send("/app/user.disconnectUser", {}, JSON.stringify({ nickName: nickname, fullName: fullname, status: 'OFFLINE' }));
        stompClient.disconnect();
    }
    window.location.reload();
}

usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', sendMessage, true);
logout.addEventListener('click', onLogout, true);
window.onbeforeunload = () => onLogout();