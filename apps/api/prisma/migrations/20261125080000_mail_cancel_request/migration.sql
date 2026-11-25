-- D-111: un mail que pide cancelar un pedido no crea orden: queda registrado con este resultado.
ALTER TYPE "MailIngestResult" ADD VALUE 'CANCEL_REQUEST';
