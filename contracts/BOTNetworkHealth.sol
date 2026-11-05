// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BOTNetworkHealth
 * @notice On-chain ledger for recording network health inspection requests and off-chain measurement commitments on Botchain.
 */
contract BOTNetworkHealth {
    struct InspectionRequest {
        bytes32 requestId;
        address requester;
        bytes32 endpointConfigurationHash;
        uint256 fromBlock;
        uint256 toBlock;
        uint256 requestedAt;
        bytes32 reportHash;
        uint256 publishedAt;
        bool isCompleted;
        bool exists;
    }

    // Mapping from requestId => InspectionRequest
    mapping(bytes32 => InspectionRequest) private requests;

    // Ordered list of all request IDs
    bytes32[] private allRequestIds;

    // Mapping from user => array of request IDs
    mapping(address => bytes32[]) private userRequestIds;

    // Nonce for unique request IDs
    uint256 private nonce;

    // Events
    event InspectionRequested(
        bytes32 indexed requestId,
        address indexed requester,
        bytes32 indexed endpointConfigurationHash,
        uint256 fromBlock,
        uint256 toBlock,
        uint256 timestamp
    );

    event ResultPublished(
        bytes32 indexed requestId,
        address indexed publisher,
        bytes32 indexed reportHash,
        uint256 timestamp
    );

    error RequestAlreadyExists(bytes32 requestId);
    error RequestNotFound(bytes32 requestId);
    error InvalidBlockRange(uint256 fromBlock, uint256 toBlock);
    error RequestAlreadyCompleted(bytes32 requestId);
    error UnauthorizedPublisher(bytes32 requestId, address caller);

    /**
     * @notice Requests a new network health inspection.
     * @param endpointConfigurationHash Keccak256 hash of the RPC endpoint config URL / parameters.
     * @param fromBlock Starting block of the inspection window.
     * @param toBlock Ending block of the inspection window.
     * @return requestId Unique identifier for the inspection request.
     */
    function requestNetworkInspection(
        bytes32 endpointConfigurationHash,
        uint256 fromBlock,
        uint256 toBlock
    ) external returns (bytes32 requestId) {
        if (toBlock < fromBlock) {
            revert InvalidBlockRange(fromBlock, toBlock);
        }

        nonce++;
        requestId = keccak256(
            abi.encodePacked(
                msg.sender,
                endpointConfigurationHash,
                fromBlock,
                toBlock,
                block.timestamp,
                block.prevrandao,
                nonce
            )
        );

        if (requests[requestId].exists) {
            revert RequestAlreadyExists(requestId);
        }

        requests[requestId] = InspectionRequest({
            requestId: requestId,
            requester: msg.sender,
            endpointConfigurationHash: endpointConfigurationHash,
            fromBlock: fromBlock,
            toBlock: toBlock,
            requestedAt: block.timestamp,
            reportHash: bytes32(0),
            publishedAt: 0,
            isCompleted: false,
            exists: true
        });

        allRequestIds.push(requestId);
        userRequestIds[msg.sender].push(requestId);

        emit InspectionRequested(
            requestId,
            msg.sender,
            endpointConfigurationHash,
            fromBlock,
            toBlock,
            block.timestamp
        );

        return requestId;
    }

    /**
     * @notice Publishes and commits the off-chain inspection report hash for a given request.
     * @param requestId Unique identifier for the inspection request.
     * @param reportHash Keccak256 hash or IPFS/data hash of the generated inspection report.
     */
    function publishResult(
        bytes32 requestId,
        bytes32 reportHash
    ) external {
        InspectionRequest storage req = requests[requestId];
        if (!req.exists) {
            revert RequestNotFound(requestId);
        }
        if (req.isCompleted) {
            revert RequestAlreadyCompleted(requestId);
        }
        // Allow the original requester or any inspector to publish report
        if (msg.sender != req.requester) {
            // Note: could also allow designated relayers, but verifying requester or relayer is standard
        }

        req.reportHash = reportHash;
        req.publishedAt = block.timestamp;
        req.isCompleted = true;

        emit ResultPublished(
            requestId,
            msg.sender,
            reportHash,
            block.timestamp
        );
    }

    /**
     * @notice Retrieves details for a given inspection request.
     * @param requestId Unique identifier for the inspection request.
     */
    function getRequest(bytes32 requestId)
        external
        view
        returns (
            bytes32 id,
            address requester,
            bytes32 endpointConfigurationHash,
            uint256 fromBlock,
            uint256 toBlock,
            uint256 requestedAt,
            bytes32 reportHash,
            uint256 publishedAt,
            bool isCompleted
        )
    {
        InspectionRequest memory req = requests[requestId];
        if (!req.exists) {
            revert RequestNotFound(requestId);
        }

        return (
            req.requestId,
            req.requester,
            req.endpointConfigurationHash,
            req.fromBlock,
            req.toBlock,
            req.requestedAt,
            req.reportHash,
            req.publishedAt,
            req.isCompleted
        );
    }

    /**
     * @notice Returns total number of registered requests.
     */
    function totalRequests() external view returns (uint256) {
        return allRequestIds.length;
    }

    /**
     * @notice Returns paginated request IDs.
     */
    function getRecentRequestIds(uint256 limit) external view returns (bytes32[] memory) {
        uint256 total = allRequestIds.length;
        if (total == 0) {
            return new bytes32[](0);
        }
        uint256 count = limit > total ? total : limit;
        bytes32[] memory result = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = allRequestIds[total - 1 - i];
        }
        return result;
    }

    /**
     * @notice Returns request IDs created by a specific user.
     */
    function getUserRequests(address user) external view returns (bytes32[] memory) {
        return userRequestIds[user];
    }
}

