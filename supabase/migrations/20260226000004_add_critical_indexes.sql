-- no-transaction
-- =============================================================================
-- STORY-006: Indexes criticos de performance
-- Prioridade: P1 | Impacto: ALTO
--
-- Contexto: bids e wallet_transactions sao as tabelas de maior volume e
-- nao possuem indexes alem da PK. Sem indexes, queries de lookup por
-- user_id ou lot_id resultam em full table scans, degradando performance
-- conforme o volume cresce.
--
-- Todos os indexes usam CONCURRENTLY para nao bloquear writes em producao
-- e IF NOT EXISTS para idempotencia (re-executavel sem erro).
--
-- NOTA: a tabela "lots" usa "created_by" como campo do criador do lote —
-- nao existe coluna "seller_id" nesta tabela. O index abaixo usa created_by.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- bids (tabela de maior volume — zero indexes alem de PK)
-- -----------------------------------------------------------------------------

-- Lookup de todos os lances de um lote (ex: exibir historico, calcular vencedor)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_id
  ON bids(lot_id);

-- Lookup de todos os lances de um usuario (ex: historico do usuario)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_user_id
  ON bids(user_id);

-- Lance maximo por lote — usado pelo close-auctions e pela UI para mostrar
-- o lance atual sem full scan com ORDER BY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_amount_desc
  ON bids(lot_id, amount DESC);

-- Ordenacao cronologica de lances (feed, auditoria)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_created_at
  ON bids(created_at DESC);

-- -----------------------------------------------------------------------------
-- wallet_transactions (ledger financeiro — alto volume)
-- -----------------------------------------------------------------------------

-- Lookup de todas as transacoes de um usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_tx_user_id
  ON wallet_transactions(user_id);

-- Extrato do usuario ordenado por data (query mais comum na UI)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_tx_user_created
  ON wallet_transactions(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- notifications (alto volume, maioria nao lida)
-- -----------------------------------------------------------------------------

-- Lookup de notificacoes de um usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

-- Badge de notificacoes nao lidas — partial index para rows WHERE read_at IS NULL
-- (exclui notificacoes ja lidas, reduzindo tamanho do index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- lots (query principal do close-auctions e da listagem)
-- -----------------------------------------------------------------------------

-- Filtro por status (ex: WHERE status = 'live')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_status
  ON lots(status);

-- Partial index para lotes ativos com data de encerramento —
-- query critica do job close-auctions: WHERE status = 'live' AND ends_at <= now()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_status_ends_at
  ON lots(status, ends_at)
  WHERE status = 'live';

-- Lookup por criador do lote (coluna created_by — nao existe seller_id em lots)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_created_by
  ON lots(created_by);

-- -----------------------------------------------------------------------------
-- withdrawals
-- -----------------------------------------------------------------------------

-- Lookup de saques de um usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_id
  ON withdrawals(user_id);

-- Filtro por status (ex: saques pendentes para processamento pelo admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_status
  ON withdrawals(status);

-- -----------------------------------------------------------------------------
-- transfers
-- -----------------------------------------------------------------------------

-- Lookup de transferencias enviadas por um usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_from_user
  ON transfers(from_user_id);

-- Lookup de transferencias recebidas por um usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_to_user
  ON transfers(to_user_id);
