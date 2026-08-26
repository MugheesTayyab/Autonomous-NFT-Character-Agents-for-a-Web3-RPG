import React, { useState, useEffect } from 'react';
import { CharacterStatus } from '../types';
import { API_BASE_URL } from '../hooks/useWebSocket';

interface CharacterCardProps {
  character: CharacterStatus;
  onRefresh?: () => void;
  onToggleStakeFallback?: (tokenId: number) => void;
  onRevokeFallback?: (tokenId: number) => void;
}

const ARCHETYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  BERSERKER: {
    bg: 'bg-[#faece9]',
    text: 'text-[#9e3b25]',
    border: 'border-[#f2d4ce]',
  },
  STRATEGIST: {
    bg: 'bg-[#edf4f2]',
    text: 'text-[#2d4a43]',
    border: 'border-[#d4e4e0]',
  },
  SCAVENGER: {
    bg: 'bg-[#fef7eb]',
    text: 'text-[#925f17]',
    border: 'border-[#fbe4be]',
  },
  DIPLOMAT: {
    bg: 'bg-[#eaf3ec]',
    text: 'text-[#234232]',
    border: 'border-[#cce1d1]',
  },
  HOARDER: {
    bg: 'bg-[#f3efeb]',
    text: 'text-[#574c43]',
    border: 'border-[#ded7ce]',
  },
};

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onRefresh,
  onToggleStakeFallback,
  onRevokeFallback,
}) => {
  const [isStakingLoading, setIsStakingLoading] = useState(false);
  const [isRevokeLoading, setIsRevokeLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('--');

  const { tokenId, name, archetype, traits, sessionKey, staking } = character;
  const isStaked = Boolean(staking?.isStaked);

  const archetypeStyle = ARCHETYPE_STYLES[archetype.toUpperCase()] || {
    bg: 'bg-sand-100',
    text: 'text-stone-700',
    border: 'border-sand-200',
  };

  // Format session key countdown
  useEffect(() => {
    if (!sessionKey?.expiresAt || !sessionKey?.isActive) {
      setTimeRemainingStr('Inactive');
      return;
    }

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = sessionKey.expiresAt! - now;
      if (diff <= 0) {
        setTimeRemainingStr('Expired');
      } else {
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const secs = diff % 60;
        setTimeRemainingStr(`${hours}h ${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionKey]);

  // Handle manual stake/unstake toggle with live backend + client fallback
  const handleToggleStake = async () => {
    setIsStakingLoading(true);
    setActionError(null);
    try {
      if (API_BASE_URL) {
        const endpoint = isStaked ? '/api/actions/unstake' : '/api/actions/stake';
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenId }),
        });
        if (res.ok) {
          if (onRefresh) onRefresh();
          return;
        }
      }
      // If API not available or errored, execute client-side simulation
      if (onToggleStakeFallback) {
        onToggleStakeFallback(tokenId);
      }
    } catch {
      if (onToggleStakeFallback) {
        onToggleStakeFallback(tokenId);
      }
    } finally {
      setIsStakingLoading(false);
    }
  };

  // Handle Master Kill Switch Revocation with live backend + client fallback
  const handleRevokeKey = async () => {
    if (!confirm(`Confirm emergency revocation of Session Key for ${name} (Token #${tokenId})?`)) {
      return;
    }
    setIsRevokeLoading(true);
    setActionError(null);
    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/api/session-keys/${tokenId}/revoke`, {
          method: 'POST',
        });
        if (res.ok) {
          if (onRefresh) onRefresh();
          return;
        }
      }
      // Fallback
      if (onRevokeFallback) {
        onRevokeFallback(tokenId);
      }
    } catch {
      if (onRevokeFallback) {
        onRevokeFallback(tokenId);
      }
    } finally {
      setIsRevokeLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border-subtle hover:border-border-strong transition-all shadow-card hover:shadow-elevated flex flex-col justify-between overflow-hidden">
      
      {/* Card Header */}
      <div className="p-4 sm:p-5 border-b border-border-subtle/70">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-stone-600">
              #{tokenId}
            </span>
            <span className={`text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border ${archetypeStyle.bg} ${archetypeStyle.text} ${archetypeStyle.border}`}>
              {archetype}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {isStaked ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-forest-700 bg-forest-50 px-2 py-0.5 rounded-md border border-forest-200">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-600 animate-pulse"></span>
                Staked
              </span>
            ) : (
              <span className="text-[11px] font-medium text-stone-400 bg-surface-subtle px-2 py-0.5 rounded-md border border-border-subtle">
                Unstaked
              </span>
            )}
          </div>
        </div>

        <h3 className="font-bold text-stone-900 text-sm sm:text-base tracking-tight truncate" title={name}>
          {name}
        </h3>

        {/* Staking & REWA Yield Banner */}
        <div className="mt-3 p-2.5 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-between text-xs gap-2">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">
              Pending Yield
            </span>
            <span className="font-mono font-bold text-stone-800 tabular-numbers truncate block">
              {staking?.estimatedPendingRewardsFormatted || '0.0000'} <span className="text-forest-700 font-sans font-semibold text-[10px]">REWA</span>
            </span>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">
              Cycle Status
            </span>
            <span className="text-[11px] font-semibold text-stone-600">
              {isStaked ? 'Accruing' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* Trait Meters */}
      <div className="p-4 sm:p-5 space-y-3 bg-surface">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium">
            <span className="text-stone-500">Risk Tolerance</span>
            <span className="font-mono text-stone-700">{traits.riskTolerance} / 100</span>
          </div>
          <div className="h-1.5 w-full bg-sand-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-700 rounded-full transition-all duration-300"
              style={{ width: `${traits.riskTolerance}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium">
            <span className="text-stone-500">Aggression</span>
            <span className="font-mono text-stone-700">{traits.aggression} / 100</span>
          </div>
          <div className="h-1.5 w-full bg-sand-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#9e3b25] rounded-full transition-all duration-300"
              style={{ width: `${traits.aggression}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium">
            <span className="text-stone-500">Trust Baseline</span>
            <span className="font-mono text-stone-700">{traits.trustBaseline} / 100</span>
          </div>
          <div className="h-1.5 w-full bg-sand-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-forest-600 rounded-full transition-all duration-300"
              style={{ width: `${traits.trustBaseline}%` }}
            />
          </div>
        </div>
      </div>

      {/* Session Key Security Info & Actions */}
      <div className="p-4 sm:p-5 pt-0 space-y-3">
        <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-between text-[11px] gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <svg className="w-3.5 h-3.5 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div className="min-w-0">
              <span className="text-stone-600 font-mono text-[10px] block truncate">
                {sessionKey?.walletAddress ? `${sessionKey.walletAddress.slice(0, 6)}...${sessionKey.walletAddress.slice(-4)}` : 'No Key'}
              </span>
              <span className="text-stone-400 block text-[10px]">
                {sessionKey?.isActive ? `Expires: ${timeRemainingStr}` : 'Key Revoked'}
              </span>
            </div>
          </div>

          {sessionKey?.isActive && (
            <button
              onClick={handleRevokeKey}
              disabled={isRevokeLoading}
              title="Master Kill Switch: Immediately revoke agent session key on-chain"
              className="text-[10px] font-medium text-stone-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors border border-transparent hover:border-red-200 shrink-0 whitespace-nowrap"
            >
              {isRevokeLoading ? 'Revoking...' : 'Revoke'}
            </button>
          )}
        </div>

        {actionError && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg">
            {actionError}
          </div>
        )}

        {/* Primary Action Button */}
        <button
          onClick={handleToggleStake}
          disabled={isStakingLoading}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-subtle flex items-center justify-center gap-1.5 ${
            isStaked
              ? 'bg-surface hover:bg-surface-subtle border border-border-subtle text-stone-700'
              : 'bg-forest-800 hover:bg-forest-900 text-white'
          }`}
        >
          {isStakingLoading ? (
            <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
          ) : isStaked ? (
            <>
              <svg className="w-3.5 h-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
              Unstake from Vault
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
              Stake in Vault
            </>
          )}
        </button>
      </div>

    </div>
  );
};
