-- Push alerts run after each hour's scores (:15) and snapshot (:20). Receipts are read every 30
-- minutes; Expo asks for at least 15 minutes after sending.
select cron.schedule('send-alerts', '25 * * * *', $$select public.invoke_function('send-alerts')$$);
select cron.schedule('check-receipts', '*/30 * * * *', $$select public.invoke_function('check-receipts')$$);
