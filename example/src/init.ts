import socketStore from "./test";

const container = document.querySelector('#root');

function createChat(){
  const input = document.createElement('input');
  const button = document.createElement('button');
  const form  = document.createElement('form');
  button.innerText = 'Send';
  button.addEventListener('click', () => {
    const value = input.value;
    socketStore.send({key:'talk', data: value});
  });
  const chat = document.createElement('div');
  form.appendChild(input);
  form.appendChild(button);
  chat.appendChild(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    button.click();
    input.value = ''; 
  });
  return chat;
}

const conversation = document.createElement('div');
socketStore.subscribe('talk', (data: Array<{name:string, message: string}>) => {
  console.log(data);
  const lastest = data.at(-1);
  const p = document.createElement('p');
  p.innerText = `${lastest?.name}: ${lastest?.message}`;
  conversation.appendChild(p);

});



function init(){
  console.log('hi');
  const chat = createChat()

  container?.appendChild(chat);
  container?.appendChild(conversation);
};
init();



