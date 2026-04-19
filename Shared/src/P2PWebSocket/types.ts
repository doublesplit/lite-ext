export interface MessageOffer {
    action: 'announce';
    info_hash: string;
    offer: RTCSessionDescriptionInit;
    offer_id: string;
    peer_id: string;
}

export interface MessageAnswer {
    action: 'announce';
    answer: RTCSessionDescriptionInit;
    info_hash: string;
    offer_id: string;
    peer_id: string;
    to_offer_id: string;
    to_peer_id: string;
}

export interface MessageStats {
    action: 'announce';
    complete: number;
    incomplete: number;
    info_hash: string;
    interval: number;
}
